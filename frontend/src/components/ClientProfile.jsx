import React, { useState, useRef, useEffect } from 'react';
import { Card, Row, Col, Form, Button, Image, Spinner, Alert } from 'react-bootstrap';
import { ArrowLeft, Upload } from 'lucide-react';

const PROFILE_IMAGE_KEY = 'clientProfileImage';

const initialProfile = {
  firstname: '',
  lastname: '',
  dob: '',
  email: '',
  phoneno: '',
  cnic: '',
  address: '',
  password: '',
};

function ClientProfile({ onBack }) {
  const [profile, setProfile] = useState({
  firstname: '',
  lastname: '',
  dob: '',
  email: '',
  phoneno: '',
  cnic: '',
  address: '',
  password: '',
});
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState(localStorage.getItem(PROFILE_IMAGE_KEY) || 'https://placehold.co/150');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef();

  // API Calls
  const fetchClientProfile = async () => {
    const res = await fetch('/api/clientprofile', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('userToken')}`,
      },
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.message || 'Failed to load profile');
    return result.data;
  };

  const updateClientProfile = async (data) => {
    const res = await fetch('/api/clientprofile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('userToken')}`,
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.message || 'Failed to update profile');
    return result;
  };

  // Fetch profile on mount
  useEffect(() => {
    const storedImage = localStorage.getItem(PROFILE_IMAGE_KEY);
    if (storedImage) setProfileImage(storedImage);

    const loadProfile = async () => {
      setLoading(true);
      try {
        const data = await fetchClientProfile();
        console.log("Fetched Profile Data: ", data); // Debugging line to check data
        setProfile({
          firstname: data.firstName,
          lastname: data.lastName,
          dob: data.dob,
          email: data.email,
          phoneno: data.phone,
          cnic: data.cnic,
          address: data.address,
        });
        localStorage.setItem('clientProfile', JSON.stringify(data));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProfileImage(url);
      localStorage.setItem(PROFILE_IMAGE_KEY, url);
      // Optionally: upload image to backend
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    const stored = localStorage.getItem('clientProfile');
    if (stored) setProfile(JSON.parse(stored));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Call the API to update the profile
      const updatedProfile = await updateClientProfile(profile);
      setIsEditing(false);
      localStorage.setItem('clientProfile', JSON.stringify(updatedProfile.data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline-secondary"
        className="d-inline-flex align-items-center gap-2 mb-3"
        onClick={onBack}
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </Button>
      <Row className="justify-content-center align-items-center">
      <Col md={8} lg={6} xl={5}>
        <Card className="shadow-sm rounded-4 p-4">
          <Card.Body>
            <div className="d-flex flex-column align-items-center mb-4">
              <div className="position-relative mb-2">
                <Image
                  src={profileImage}
                  roundedCircle
                  width={120}
                  height={120}
                  style={{ objectFit: 'cover', border: '3px solid #e0e7ef' }}
                  alt="Profile"
                />
                {isEditing && (
                  <Button
                    variant="light"
                    className="position-absolute bottom-0 end-0 p-2 border"
                    style={{ borderRadius: '50%' }}
                    onClick={() => fileInputRef.current.click()}
                  >
                    <Upload size={18} />
                  </Button>
                )}
                <Form.Control
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleImageChange}
                />
              </div>
              <h5 className="mb-0">{profile.firstname} {profile.lastname}</h5>
              <div className="text-muted small">{profile.email}</div>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleSave}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>First Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="firstname"
                      value={profile.firstname}
                      onChange={handleChange}
                      disabled={!isEditing}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Last Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="lastname"
                      value={profile.lastname}
                      onChange={handleChange}
                      disabled={!isEditing}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Date of Birth</Form.Label>
                    <Form.Control
                      type="date"
                      name="dob"
                      value={profile.dob}
                      onChange={handleChange}
                      disabled={!isEditing}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={profile.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Phone Number</Form.Label>
                    <Form.Control
                      type="tel"
                      name="phoneno"
                      value={profile.phoneno}
                      onChange={handleChange}
                      disabled={!isEditing}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>CNIC</Form.Label>
                    <Form.Control
                      type="text"
                      name="cnic"
                      value={profile.cnic}
                      onChange={handleChange}
                      disabled={!isEditing}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Address</Form.Label>
                    <Form.Control
                      type="text"
                      name="address"
                      value={profile.address}
                      onChange={handleChange}
                      disabled={!isEditing}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="password"
                      value={profile.password}
                      onChange={handleChange}
                      disabled={!isEditing}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex justify-content-end gap-2 mt-4">
                {isEditing ? (
                  <>
                    <Button variant="secondary" onClick={handleCancel} disabled={loading}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={loading}>
                      {loading ? <Spinner size="sm" animation="border" /> : 'Save Changes'}
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" onClick={handleEdit}>Edit Profile</Button>
                )}
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Col>
      </Row>
    </>
  );
}

export default ClientProfile;
