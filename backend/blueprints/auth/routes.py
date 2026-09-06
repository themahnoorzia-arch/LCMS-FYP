import random
import re
import datetime

from flask import request, jsonify, session, current_app
from flask_login import (
    login_user,
    logout_user,
    login_required,
    current_user,
)
from flask_mail import Message

from sqlalchemy import text

from werkzeug.security import (
    generate_password_hash,
    check_password_hash,
)

from blueprints.auth import auth_bp
from db.db import SessionLocal, get_pg_connection
from extensions import mail
from models import (
    Users,
    Lawyer,
    Judge,
    Admin,
    Courtregistrar,
    Caseparticipant,
)
from utils.validators import (
    normalize_digits as _normalize_digits,
    is_valid_cnic as _is_valid_cnic,
    is_valid_pk_phone as _is_valid_pk_phone,
    is_adult_dob as _is_adult_dob,
)


def _send_otp_email(to_email, firstname, otp, purpose="verify"):
    """Send a branded OTP email. Returns True on success, False on failure."""
    try:
        subject = "Your Court Central verification code" if purpose == "verify" \
                  else "Your Court Central password reset code"
        action_text = "verify your email address" if purpose == "verify" \
                      else "reset your password"
        msg = Message(subject=subject, recipients=[to_email])
        msg.html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;
                    padding:36px 32px;background:#f9fafb;border-radius:12px;">
          <h2 style="color:#22304a;margin-bottom:4px;">Court Central</h2>
          <p style="color:#6b7280;font-size:13px;margin-top:0;">Legal Case Management System</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
          <p style="color:#374151;font-size:15px;">Hi {firstname},</p>
          <p style="color:#374151;font-size:15px;">
            Use the code below to {action_text}. It expires in <strong>10 minutes</strong>.
          </p>
          <div style="margin:28px 0;text-align:center;">
            <span style="display:inline-block;letter-spacing:10px;font-size:36px;
                         font-weight:700;color:#22304a;background:#e0f7f5;
                         padding:16px 28px;border-radius:10px;font-family:monospace;">
              {otp}
            </span>
          </div>
          <p style="color:#9ca3af;font-size:13px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
        """
        mail.send(msg)
        return True
    except Exception as exc:
        current_app.logger.error("OTP email failed to %s: %s", to_email, exc)
        return False


def _verify_password(stored_password, provided_password):
    """Accept hashed passwords and legacy plain-text rows in the database."""
    if not stored_password:
        return False
    if stored_password.startswith(("scrypt:", "pbkdf2:")):
        return check_password_hash(stored_password, provided_password)
    return stored_password == provided_password


# Roles that carry real court authority — accounts start "pending" and
# can't log in until an existing Admin approves them from the admin panel.
ROLES_REQUIRING_APPROVAL = {"Judge", "CourtRegistrar"}


def _sync_user_id_sequence(db):
    """Keep PostgreSQL userid sequence aligned with existing rows."""
    db.execute(
        text(
            "SELECT setval("
            "pg_get_serial_sequence('users', 'userid'), "
            "COALESCE((SELECT MAX(userid) FROM users), 0)"
            ")"
        )
    )


# ------------------------------------------------------------------
# SIGNUP
# ------------------------------------------------------------------
@auth_bp.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json()

    firstname = (data.get("firstname") or "").strip()
    lastname = (data.get("lastname") or "").strip()
    email = (data.get("email") or "").strip()
    phoneno = (data.get("phoneno") or "").strip()
    cnic = (data.get("cnic") or "").strip()
    dob = data.get("dob")
    password = data.get("password") or ""
    role = data.get("role", "").strip().lower()

    # All fields are mandatory — no partial signups
    required = {
        "First name": firstname,
        "Last name": lastname,
        "Email": email,
        "Phone number": phoneno,
        "CNIC": cnic,
        "Date of birth": dob,
        "Password": password,
        "Role": role,
    }
    missing = [label for label, value in required.items() if not value]
    if missing:
        return jsonify({
            "success": False,
            "message": f"{', '.join(missing)} {'is' if len(missing) == 1 else 'are'} required."
        }), 400

    # Admin accounts can never be self-registered — technical team only,
    # added directly via the admin dashboard's role-management tools.
    if role == "admin":
        return jsonify({
            "success": False,
            "message": "Admin accounts cannot be created through signup."
        }), 400

    role_mapping = {
        "courtregistrar": "CourtRegistrar",
        "client": "CaseParticipant",
        "lawyer": "Lawyer",
        "judge": "Judge",
    }

    role = role_mapping.get(role, role)

    valid_roles = [
        "CourtRegistrar",
        "CaseParticipant",
        "Lawyer",
        "Judge",
    ]

    if role not in valid_roles:
        return jsonify({
            "success": False,
            "message": "Invalid role"
        }), 400

    cnic_digits = _normalize_digits(cnic)
    if not _is_valid_cnic(cnic_digits):
        return jsonify({
            "success": False,
            "message": "CNIC must be exactly 13 digits (e.g. 12345-1234567-1)."
        }), 400

    phone_digits = _normalize_digits(phoneno)
    if not _is_valid_pk_phone(phone_digits):
        return jsonify({
            "success": False,
            "message": "Phone number must be a valid 11-digit Pakistani mobile number (e.g. 03XXXXXXXXX)."
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must be at least 8 characters."
        }), 400

    if not _is_adult_dob(dob):
        return jsonify({
            "success": False,
            "message": "You must be at least 18 years old to sign up, and the date of birth cannot be in the future.",
        }), 400

    db = SessionLocal()

    try:
        # Email is the key every login/OTP/password-reset lookup uses, so it
        # must map to exactly one account — otherwise those lookups can
        # silently grab the wrong row when two signups share an email.
        existing_email = db.query(Users).filter_by(email=email).first()
        if existing_email:
            return jsonify({
                "success": False,
                "message": "An account with this email already exists."
            }), 400

        # Same CNIC cannot register twice under the same role, no matter
        # what name is used — CNIC is normalized (dashes/spaces stripped)
        # before comparison so formatting differences can't slip through.
        existing_cnic = (
            db.query(Users)
            .filter_by(cnic=cnic_digits, role=role)
            .first()
        )
        if existing_cnic:
            return jsonify({
                "success": False,
                "message": "An account with this CNIC already exists for this role."
            }), 400

        hashed_pw = generate_password_hash(password)

        _sync_user_id_sequence(db)

        user = Users(
            firstname=firstname,
            lastname=lastname,
            email=email,
            phoneno=phone_digits,
            cnic=cnic_digits,
            dob=dob,
            password=hashed_pw,
            role=role,
        )

        db.add(user)
        db.flush()
        db.commit()

        # Generate 6-digit OTP, expires in 10 minutes
        otp = str(random.randint(100000, 999999))
        expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        db.execute(
            text(
                "UPDATE users SET email_verification_token=:t, token_expires_at=:e "
                "WHERE userid=:uid"
            ),
            {"t": otp, "e": expiry, "uid": user.userid},
        )
        if role in ROLES_REQUIRING_APPROVAL:
            db.execute(
                text("UPDATE users SET approval_status='pending' WHERE userid=:uid"),
                {"uid": user.userid},
            )
        db.commit()

        email_sent = _send_otp_email(email, firstname, otp, purpose="verify")

        from utils.logging import write_log
        write_log("CREATE", f"New user registered: {firstname} {lastname} ({role})", "user")

        return jsonify({
            "success": True,
            "message": "Signup successful. Enter the OTP sent to your email.",
            "user_id": user.userid,
            "email_sent": email_sent,
            "email": email,
        }), 201

    except Exception as e:
        db.rollback()
        return jsonify({
            "success": False,
            "message": str(e),
        }), 500

    finally:
        db.close()


# ------------------------------------------------------------------
# COMPLETE PROFILE
# ------------------------------------------------------------------
@auth_bp.route("/api/complete-profile", methods=["POST"])
def complete_profile():
    db = SessionLocal()

    try:
        data = request.get_json()

        # The user_id must come from this browser's own session, set only
        # by a successful /api/verify-otp call — never trust a client-
        # supplied user_id, that's an account-takeover path (anyone could
        # "complete the profile" of any existing user id and get logged in).
        user_id = session.get("otp_verified_user_id")

        if not user_id:
            return jsonify({
                "message": "Please verify your email before completing your profile."
            }), 401

        user = db.query(Users).get(user_id)

        if not user:
            return jsonify({
                "message": "User not found"
            }), 404

        # No separate is_email_verified check needed here — the session
        # flag above already proves this exact user just passed OTP
        # verification (is_email_verified isn't a mapped ORM column on
        # Users, so a getattr check on it here would silently always
        # fall back to its default instead of reading the real value).

        role_mapping = {
            "courtregistrar": "CourtRegistrar",
            "caseparticipant": "CaseParticipant",
            "admin": "Admin",
            "lawyer": "Lawyer",
            "judge": "Judge",
        }

        role = user.role.lower()
        user.role = role_mapping.get(role, role)

        # ----------------------------------------------------------
        # Client
        # ----------------------------------------------------------
        if user.role == "CaseParticipant":
            address = data.get("address")

            if not address:
                return jsonify({
                    "success": False,
                    "message": "Address is required.",
                }), 400

            client = Caseparticipant(
                userid=user.userid,
                address=address,
            )

            db.add(client)
            db.commit()

        # ----------------------------------------------------------
        # Admin
        # ----------------------------------------------------------
        elif user.role == "Admin":
            admin = Admin(userid=user.userid)

            db.add(admin)
            db.commit()

        # ----------------------------------------------------------
        # Lawyer
        # ----------------------------------------------------------
        elif user.role == "Lawyer":

            bar_license = data.get("barLicense")
            experience = data.get("experience")

            try:
                barlicenseno = int(str(bar_license).strip())
                experienceyears = int(experience)
            except (TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "message": "Bar license and experience must be valid numbers.",
                }), 400

            if db.query(Lawyer).filter_by(barlicenseno=barlicenseno).first():
                return jsonify({
                    "success": False,
                    "message": "This bar license number is already registered to another account. Please double-check it and try again.",
                }), 409

            lawyer = Lawyer(
                userid=user.userid,
                barlicenseno=barlicenseno,
                experienceyears=experienceyears,
                specialization=data.get("specialization"),
            )

            db.add(lawyer)
            db.commit()

        # ----------------------------------------------------------
        # Judge
        # ----------------------------------------------------------
        elif user.role == "Judge":

            try:
                expyears = int(data.get("experience"))
            except (TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "message": "Experience must be a valid number.",
                }), 400

            judge = Judge(
                userid=user.userid,
                position=data.get("position"),
                specialization=data.get("specialization"),
                expyears=expyears,
            )

            db.add(judge)
            db.commit()

        # ----------------------------------------------------------
        # Registrar
        # ----------------------------------------------------------
        elif user.role == "CourtRegistrar":

            registrar = Courtregistrar(
                userid=user.userid,
                position=data.get("position"),
            )

            db.add(registrar)
            db.commit()

        # One-shot: this OTP-verification proof is consumed the moment the
        # profile it was meant for is completed, verified or not.
        session.pop("otp_verified_user_id", None)

        if user.role in ROLES_REQUIRING_APPROVAL:
            approval_status = db.execute(
                text("SELECT approval_status FROM users WHERE userid=:uid"),
                {"uid": user.userid},
            ).scalar()
            if approval_status != "approved":
                return jsonify({
                    "success": True,
                    "pending_approval": True,
                    "message": (
                        "Your profile is complete. A "
                        f"{'judge' if user.role == 'Judge' else 'court registrar'} "
                        "account needs admin approval before you can log in — "
                        "you'll be notified once it's reviewed."
                    ),
                }), 200

        login_user(user)

        return jsonify({
            "success": True,
            "message": "Profile completed successfully",
        }), 200

    except Exception as e:
        db.rollback()

        # Never surface a raw SQL/constraint error to the user — translate
        # the ones we know about into plain language, and keep the rest
        # generic rather than dumping database internals on-screen.
        err_text = str(e)
        if "lawyer_barlicenseno_key" in err_text:
            message = "This bar license number is already registered to another account. Please double-check it and try again."
        else:
            message = "Something went wrong while completing your profile. Please try again."
            current_app.logger.error("complete_profile failed: %s", err_text)

        return jsonify({
            "success": False,
            "message": message,
        }), 500

    finally:
        db.close()


# ------------------------------------------------------------------
# LOGIN
# ------------------------------------------------------------------
@auth_bp.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required.",
        }), 400

    db = SessionLocal()

    try:
        # order_by is a safety net for any pre-existing duplicate-email rows
        # (email is now enforced unique at signup, going forward)
        user = (
            db.query(Users)
            .filter_by(email=email)
            .order_by(Users.userid.desc())
            .first()
        )

        if user and _verify_password(user.password, password):
            # Block unverified users. is_email_verified isn't a mapped ORM
            # column on Users (added to the DB directly, never added to
            # models.py), so it has to be read via raw SQL — a getattr on
            # the ORM object here would silently always return the default
            # instead of the real value, regardless of which default you pick.
            is_verified = db.execute(
                text("SELECT is_email_verified FROM users WHERE userid=:uid"),
                {"uid": user.userid},
            ).scalar()
            if not is_verified:
                return jsonify({
                    "success": False,
                    "message": "Please verify your email before logging in. Check your inbox for the verification link.",
                    "email_not_verified": True,
                    "email": user.email,
                }), 403

            if user.role in ROLES_REQUIRING_APPROVAL:
                approval_status = db.execute(
                    text("SELECT approval_status FROM users WHERE userid=:uid"),
                    {"uid": user.userid},
                ).scalar()
                if approval_status == "pending":
                    return jsonify({
                        "success": False,
                        "message": "Your account is awaiting admin approval. You'll be able to log in once it's reviewed.",
                        "pending_approval": True,
                    }), 403
                if approval_status == "rejected":
                    return jsonify({
                        "success": False,
                        "message": "Your account application was not approved. Contact the administrator for details.",
                    }), 403

            login_user(user)

            mapped_role = (
                "Client"
                if user.role == "CaseParticipant"
                else user.role
            )

            return jsonify({
                "success": True,
                "message": "Logged in",
                "email": user.email,
                "role": mapped_role,
                "user_id": user.userid,
            }), 200

        return jsonify({
            "success": False,
            "message": "Invalid credentials",
        }), 401

    finally:
        db.close()


# ------------------------------------------------------------------
# VERIFY OTP (email verification after signup)
# ------------------------------------------------------------------
@auth_bp.route("/api/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    otp = (data.get("otp") or "").strip()

    if not email or not otp:
        return jsonify({"success": False, "message": "Email and OTP are required"}), 400

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT userid, email_verification_token, token_expires_at, firstname "
            "FROM users WHERE email = %s ORDER BY userid DESC LIMIT 1",
            (email,),
        )
        row = cur.fetchone()

        if not row:
            return jsonify({"success": False, "message": "No account found with this email"}), 404

        user_id, stored_otp, expires_at, firstname = row

        if stored_otp != otp:
            return jsonify({"success": False, "message": "Incorrect code. Please check your email and try again."}), 400

        if expires_at and datetime.datetime.utcnow() > expires_at:
            return jsonify({"success": False, "message": "This code has expired. Please request a new one.", "expired": True}), 400

        cur.execute(
            "UPDATE users SET is_email_verified = TRUE, email_verification_token = NULL, token_expires_at = NULL WHERE userid = %s",
            (user_id,),
        )
        conn.commit()

        # Proof, bound to this browser's server-side session, that this
        # specific account just passed OTP verification. complete-profile
        # trusts this instead of a client-supplied user_id.
        session['otp_verified_user_id'] = user_id

        from utils.logging import write_log
        write_log("UPDATE", f"User verified their email: {email}", "user")

        return jsonify({"success": True, "message": "Email verified! You can now complete your profile."}), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        if conn:
            conn.close()


# ------------------------------------------------------------------
# RESEND OTP
# ------------------------------------------------------------------
@auth_bp.route("/api/resend-otp", methods=["POST"])
def resend_otp():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    purpose = data.get("purpose", "verify")  # "verify" or "reset"

    if not email:
        return jsonify({"success": False, "message": "Email is required"}), 400

    db = SessionLocal()
    try:
        user = db.query(Users).filter_by(email=email).order_by(Users.userid.desc()).first()
        if not user:
            return jsonify({"success": True, "message": "If that email is registered, a new code has been sent."}), 200

        if purpose == "verify":
            is_verified = db.execute(
                text("SELECT is_email_verified FROM users WHERE userid=:uid"),
                {"uid": user.userid},
            ).scalar()
            if is_verified:
                return jsonify({"success": False, "message": "This account is already verified."}), 400

        otp = str(random.randint(100000, 999999))
        expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)

        col = "email_verification_token" if purpose == "verify" else "password_reset_token"
        exp_col = "token_expires_at" if purpose == "verify" else "reset_token_expires_at"

        db.execute(
            text(f"UPDATE users SET {col}=:t, {exp_col}=:e WHERE userid=:uid"),
            {"t": otp, "e": expiry, "uid": user.userid},
        )
        db.commit()

        _send_otp_email(email, user.firstname or "there", otp, purpose=purpose)
        return jsonify({"success": True, "message": "New code sent to your email."}), 200

    except Exception as exc:
        db.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        db.close()


# ------------------------------------------------------------------
# FORGOT PASSWORD — step 1: send OTP
# ------------------------------------------------------------------
@auth_bp.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()

    if not email:
        return jsonify({"success": False, "message": "Email is required"}), 400

    db = SessionLocal()
    try:
        user = db.query(Users).filter_by(email=email).order_by(Users.userid.desc()).first()
        if not user:
            return jsonify({"success": True, "message": "If that email is registered, a reset code has been sent."}), 200

        otp = str(random.randint(100000, 999999))
        expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        db.execute(
            text("UPDATE users SET password_reset_token=:t, reset_token_expires_at=:e WHERE userid=:uid"),
            {"t": otp, "e": expiry, "uid": user.userid},
        )
        db.commit()

        _send_otp_email(email, user.firstname or "there", otp, purpose="reset")
        return jsonify({"success": True, "message": "Reset code sent to your email."}), 200

    except Exception as exc:
        db.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        db.close()


# ------------------------------------------------------------------
# RESET PASSWORD — step 2: verify OTP + set new password
# ------------------------------------------------------------------
@auth_bp.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip()
    otp = (data.get("otp") or "").strip()
    new_password = data.get("newPassword", "")

    if not email or not otp or not new_password:
        return jsonify({"success": False, "message": "Email, OTP, and new password are required"}), 400

    if len(new_password) < 8:
        return jsonify({"success": False, "message": "Password must be at least 8 characters"}), 400

    conn = None
    try:
        conn = get_pg_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT userid, password_reset_token, reset_token_expires_at "
            "FROM users WHERE email = %s ORDER BY userid DESC LIMIT 1",
            (email,),
        )
        row = cur.fetchone()

        if not row:
            return jsonify({"success": False, "message": "No account found with this email"}), 404

        user_id, stored_otp, expires_at = row

        if stored_otp != otp:
            return jsonify({"success": False, "message": "Incorrect code. Please try again."}), 400

        if expires_at and datetime.datetime.utcnow() > expires_at:
            return jsonify({"success": False, "message": "This code has expired. Please request a new one.", "expired": True}), 400

        hashed = generate_password_hash(new_password)
        cur.execute(
            "UPDATE users SET password = %s, password_reset_token = NULL, reset_token_expires_at = NULL WHERE userid = %s",
            (hashed, user_id),
        )
        conn.commit()

        from utils.logging import write_log
        write_log("UPDATE", f"Password reset for user: {email}", "user")

        return jsonify({"success": True, "message": "Password updated successfully. You can now log in."}), 200

    except Exception as exc:
        if conn:
            conn.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
    finally:
        if conn:
            conn.close()


# ------------------------------------------------------------------
# DASHBOARD
# ------------------------------------------------------------------
@auth_bp.route("/api/dashboard", methods=["GET"])
@login_required
def dashboard():
    db = SessionLocal()

    try:
        lawyer = (
            db.query(Lawyer)
            .filter_by(userid=current_user.userid)
            .first()
        )

        specialization = (
            lawyer.specialization
            if lawyer
            else None
        )

        barlicenseno = (
            lawyer.barlicenseno
            if lawyer
            else None
        )

        return jsonify({
            "success": True,
            "user": {
                "username":
                    f"{current_user.firstname} "
                    f"{current_user.lastname}",
                "specialization": specialization,
                "barlicenseno": barlicenseno,
            },
        })

    finally:
        db.close()


# ------------------------------------------------------------------
# LOGOUT
# ------------------------------------------------------------------
@auth_bp.route("/api/logout", methods=["POST"])
@login_required
def logout():
    logout_user()

    return jsonify({
        "success": True,
        "message": "Logged out",
    })