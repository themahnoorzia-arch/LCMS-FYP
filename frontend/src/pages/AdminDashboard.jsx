import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { performLogout } from '../utils/logout';
import {
  Table, Form, Card, Spinner, Alert,
  Badge, Button, Modal, Row, Col, InputGroup,
} from 'react-bootstrap';
import { LogOut, Users, FileText, ClipboardList, LayoutDashboard, UserCheck, Building2, Plus, Trash2 } from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────

const statusBadge = (status) => {
  const map = {
    Open: 'success', Pending: 'warning', Closed: 'secondary',
    Success: 'success', Error: 'danger', scheduled: 'secondary',
  };
  return <Badge bg={map[status] || 'secondary'}>{status}</Badge>;
};

const roleBadge = (role) => {
  const map = {
    Admin: 'danger', Judge: 'primary', Lawyer: 'info',
    CourtRegistrar: 'success', CaseParticipant: 'secondary',
  };
  return <Badge bg={map[role] || 'secondary'}>{role}</Badge>;
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
};

const fmtDateTime = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(); } catch { return d; }
};

// ── main component ─────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState('overview');
  const [adminData, setAdminData] = useState({ username: 'Admin' });

  // data states
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pending, setPending] = useState([]);

  // ui states
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [searchUser, setSearchUser] = useState('');
  const [searchCase, setSearchCase] = useState('');
  const [searchLog, setSearchLog] = useState('');

  // role change modal
  const [deleteModal, setDeleteModal] = useState({ show: false, user: null });
  const [actionMsg, setActionMsg] = useState(null);

  // Court assignment modal — shown when approving a CourtRegistrar
  // applicant, since courts are never self-declared or created here —
  // only ever picked from the pre-existing list managed on the Manage
  // Courts page.
  const [courtAssignModal, setCourtAssignModal] = useState({ show: false, user: null, courtid: '' });
  const [unclaimedCourts, setUnclaimedCourts] = useState([]);
  const [loadingUnclaimedCourts, setLoadingUnclaimedCourts] = useState(false);
  const [courtAssignError, setCourtAssignError] = useState(null);
  const [courtAssignSubmitting, setCourtAssignSubmitting] = useState(false);

  // Manage Courts page
  const [courts, setCourts] = useState([]);
  const [searchCourtMgmt, setSearchCourtMgmt] = useState('');
  const [addCourtModal, setAddCourtModal] = useState({ show: false, name: '', type: '', location: '', error: null, submitting: false });
  const [deleteCourtModal, setDeleteCourtModal] = useState({ show: false, court: null });

  // ── fetch helpers ──────────────────────────────────────────────────────

  const load = useCallback(async (key, url, setter) => {
    setLoading(p => ({ ...p, [key]: true }));
    setErrors(p => ({ ...p, [key]: null }));
    try {
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed');
      setter(data);
    } catch (e) {
      setErrors(p => ({ ...p, [key]: e.message }));
    } finally {
      setLoading(p => ({ ...p, [key]: false }));
    }
  }, []);

  // ── load on page change ────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/adminprofile', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setAdminData({ username: `${d.data.firstName} ${d.data.lastName}`.trim() });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activePage === 'overview') {
      load('stats', '/api/admin/stats', d => setStats(d));
    }
    if (activePage === 'users') {
      load('users', '/api/admin/users', d => setUsers(d.users || []));
    }
    if (activePage === 'cases') {
      load('cases', '/api/admin/cases', d => setCases(d.cases || []));
    }
    if (activePage === 'logs') {
      load('logs', '/api/logs', d => setLogs(Array.isArray(d) ? d : []));
    }
    if (activePage === 'approvals') {
      load('pending', '/api/admin/pending-approvals', d => setPending(d.pending || []));
    }
    if (activePage === 'courts') {
      load('courts', '/api/admin/courts', d => setCourts(d.courts || []));
    }
  }, [activePage]); // eslint-disable-line

  const reloadCourts = useCallback(() => {
    load('courts', '/api/admin/courts', d => setCourts(d.courts || []));
  }, [load]);

  // ── user actions ───────────────────────────────────────────────────────

  const confirmDeleteUser = async () => {
    const u = deleteModal.user;
    if (!u) return;
    try {
      const res = await fetch(`/api/admin/users/${u.userid}`, {
        method: 'DELETE', credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(prev => prev.filter(x => x.userid !== u.userid));
      setActionMsg({ type: 'success', text: `User "${u.name}" deleted.` });
    } catch (e) {
      setActionMsg({ type: 'danger', text: e.message });
    }
    setDeleteModal({ show: false, user: null });
  };

  
  const handleApproval = async (user, action, body) => {
    try {
      const res = await fetch(`/api/admin/users/${user.userid}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPending(prev => prev.filter(x => x.userid !== user.userid));
      setActionMsg({
        type: 'success',
        text: `${user.role} account "${user.name}" ${action === 'approve' ? 'approved' : 'rejected'}.`,
      });
      return true;
    } catch (e) {
      setActionMsg({ type: 'danger', text: e.message });
      return false;
    }
  };

  // CourtRegistrar approvals need a court assignment first — open the
  // modal instead of approving directly. Every other case (reject, or
  // approving a Judge) can go straight through. Courts themselves are
  // only ever created on the Manage Courts page, never here.
  const startApproval = (user) => {
    if (user.role !== 'CourtRegistrar') {
      handleApproval(user, 'approve');
      return;
    }
    setCourtAssignError(null);
    setCourtAssignModal({ show: true, user, courtid: '' });
    setLoadingUnclaimedCourts(true);
    fetch('/api/admin/unclaimed-courts', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setUnclaimedCourts(data.courts || []))
      .catch(() => setUnclaimedCourts([]))
      .finally(() => setLoadingUnclaimedCourts(false));
  };

  const submitCourtAssignApproval = async () => {
    const { user, courtid } = courtAssignModal;
    setCourtAssignError(null);

    if (!courtid) {
      setCourtAssignError('Select a court to assign this registrar to.');
      return;
    }

    setCourtAssignSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.userid}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courtid: Number(courtid) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      setPending(prev => prev.filter(x => x.userid !== user.userid));
      setActionMsg({ type: 'success', text: `CourtRegistrar account "${user.name}" approved.` });
      setCourtAssignModal({ show: false, user: null, courtid: '' });
    } catch (e) {
      setCourtAssignError(e.message);
    } finally {
      setCourtAssignSubmitting(false);
    }
  };

  // ── Manage Courts actions ──────────────────────────────────────────────

  const submitAddCourt = async () => {
    const { name, type, location } = addCourtModal;
    if (!name.trim() || !type || !location.trim()) {
      setAddCourtModal(p => ({ ...p, error: 'Court name, type, and location are all required.' }));
      return;
    }
    setAddCourtModal(p => ({ ...p, submitting: true, error: null }));
    try {
      const res = await fetch('/api/court', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, courtType: type, address: location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add court');
      setAddCourtModal({ show: false, name: '', type: '', location: '', error: null, submitting: false });
      reloadCourts();
      setActionMsg({ type: 'success', text: `Court "${name}" added.` });
    } catch (e) {
      setAddCourtModal(p => ({ ...p, submitting: false, error: e.message }));
    }
  };

  const confirmDeleteCourt = async () => {
    const c = deleteCourtModal.court;
    if (!c) return;
    try {
      const res = await fetch(`/api/admin/courts/${c.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCourts(prev => prev.filter(x => x.id !== c.id));
      setActionMsg({ type: 'success', text: `Court "${c.courtname}" deleted.` });
    } catch (e) {
      setActionMsg({ type: 'danger', text: e.message });
    }
    setDeleteCourtModal({ show: false, court: null });
  };

  const handleLogout = () => performLogout(navigate);

  // ── filtered lists ─────────────────────────────────────────────────────

  const filteredUsers = users.filter(u =>
    [u.name, u.email, u.role, u.phone, u.cnic].join(' ').toLowerCase().includes(searchUser.toLowerCase())
  );

  const filteredCases = cases.filter(c =>
    [c.title, c.casenumber, c.court, c.judge, c.client, c.status].join(' ').toLowerCase().includes(searchCase.toLowerCase())
  );

  const filteredLogs = logs.filter(l =>
    Object.values(l).join(' ').toLowerCase().includes(searchLog.toLowerCase())
  );

  // ── sidebar items ──────────────────────────────────────────────────────

  const navItems = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
    { key: 'approvals', label: 'Pending Approvals', icon: <UserCheck size={16} /> },
    { key: 'courts', label: 'Manage Courts', icon: <Building2 size={16} /> },
    { key: 'users', label: 'Users', icon: <Users size={16} /> },
    { key: 'cases', label: 'All Cases', icon: <FileText size={16} /> },
    { key: 'logs', label: 'System Logs', icon: <ClipboardList size={16} /> },
  ];

  // ── render helpers ─────────────────────────────────────────────────────

  const LoadingRow = ({ cols }) => (
    <tr><td colSpan={cols} className="text-center py-4"><Spinner size="sm" /> Loading...</td></tr>
  );

  const ErrorRow = ({ cols, msg }) => (
    <tr><td colSpan={cols} className="text-center text-danger py-3">{msg}</td></tr>
  );

  // ── pages ──────────────────────────────────────────────────────────────

  const Overview = () => (
    <div>
      <h4 className="fw-bold mb-4" style={{ color: '#22304a' }}>Overview</h4>
      {loading.stats && <div className="text-center py-5"><Spinner /></div>}
      {errors.stats && <Alert variant="danger">{errors.stats}</Alert>}
      {stats && (
        <>
          {/* Case stats */}
          <Row className="g-3 mb-4">
            {[
              { label: 'Total Cases', value: stats.cases.total, bg: '#22304a', icon: '📁' },
              { label: 'Open Cases', value: stats.cases.open, bg: '#1ec6b6', icon: '⚖️' },
              { label: 'Pending Cases', value: stats.cases.pending, bg: '#f6c344', icon: '⏳' },
              { label: 'Closed Cases', value: stats.cases.closed, bg: '#6c757d', icon: '🔒' },
            ].map(card => (
              <Col key={card.label} xs={6} md={3}>
                <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
                  <Card.Body className="d-flex align-items-center gap-3">
                    <div style={{ fontSize: 28 }}>{card.icon}</div>
                    <div>
                      <div className="fw-bold fs-4" style={{ color: card.bg }}>{card.value}</div>
                      <div className="text-muted small">{card.label}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          {/* User + hearing stats */}
          <Row className="g-3 mb-4">
            {[
              { label: 'Total Users', value: stats.users.total, bg: '#22304a', icon: '👥' },
              { label: 'Total Hearings', value: stats.hearings.total, bg: '#1ec6b6', icon: '📅' },
            ].map(card => (
              <Col key={card.label} xs={6} md={3}>
                <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
                  <Card.Body className="d-flex align-items-center gap-3">
                    <div style={{ fontSize: 28 }}>{card.icon}</div>
                    <div>
                      <div className="fw-bold fs-4" style={{ color: card.bg }}>{card.value}</div>
                      <div className="text-muted small">{card.label}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Users by role */}
          <Card className="border-0 shadow-sm" style={{ borderRadius: 12 }}>
            <Card.Body>
              <h6 className="fw-bold mb-3">Users by Role</h6>
              <div className="d-flex flex-wrap gap-3">
                {Object.entries(stats.users.by_role).map(([role, count]) => (
                  <div key={role} className="text-center p-3 rounded" style={{ background: '#f8f9fa', minWidth: 100 }}>
                    <div className="fw-bold fs-5">{count}</div>
                    <div>{roleBadge(role)}</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );

  const UsersPage = () => (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#22304a' }}>User Management</h4>
      <div className="text-muted mb-3 small">View all registered users. Change roles or remove accounts.</div>
      {actionMsg && (
        <Alert variant={actionMsg.type} dismissible onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}
      <InputGroup className="mb-3" style={{ maxWidth: 400 }}>
        <InputGroup.Text>🔍</InputGroup.Text>
        <Form.Control placeholder="Search by name, email, role…" value={searchUser} onChange={e => setSearchUser(e.target.value)} />
      </InputGroup>
      <div className="table-responsive">
        <Table hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Specialization</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading.users && <LoadingRow cols={8} />}
            {errors.users && <ErrorRow cols={8} msg={errors.users} />}
            {!loading.users && !errors.users && filteredUsers.length === 0 && (
              <tr><td colSpan={8} className="text-center text-muted py-4">No users found.</td></tr>
            )}
            {filteredUsers.map((u, i) => (
              <tr key={u.userid}>
                <td className="text-muted small">{i + 1}</td>
                <td className="fw-semibold">{u.name || '—'}</td>
                <td>{u.email}</td>
                <td>{u.phone}</td>
                <td>{roleBadge(u.role)}</td>
                <td className="text-muted small">{u.specialization}</td>
                <td className="text-muted small">{fmtDate(u.joinedAt)}</td>
                <td>
                  <div className="d-flex gap-1">
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => setDeleteModal({ show: true, user: u })}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );

  const CasesPage = () => (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#22304a' }}>All Cases</h4>
      <div className="text-muted mb-3 small">Read-only view of every case across all courts.</div>
      <InputGroup className="mb-3" style={{ maxWidth: 400 }}>
        <InputGroup.Text>🔍</InputGroup.Text>
        <Form.Control placeholder="Search by title, court, judge…" value={searchCase} onChange={e => setSearchCase(e.target.value)} />
      </InputGroup>
      <div className="table-responsive">
        <Table hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Case Name</th>
              <th>Number</th>
              <th>Type</th>
              <th>Court</th>
              <th>Judge</th>
              <th>Lawyer</th>
              <th>Client</th>
              <th>Filing Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading.cases && <LoadingRow cols={9} />}
            {errors.cases && <ErrorRow cols={9} msg={errors.cases} />}
            {!loading.cases && !errors.cases && filteredCases.length === 0 && (
              <tr><td colSpan={9} className="text-center text-muted py-4">No cases found.</td></tr>
            )}
            {filteredCases.map(c => (
              <tr key={c.caseid}>
                <td className="fw-semibold">{c.title}</td>
                <td className="text-muted small">{c.casenumber}</td>
                <td>{c.casetype}</td>
                <td>{c.court}</td>
                <td>{c.judge}</td>
                <td>{c.lawyer}</td>
                <td>{c.client}</td>
                <td className="text-muted small">{fmtDate(c.filingdate)}</td>
                <td>{statusBadge(c.status)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );

  const LogsPage = () => (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#22304a' }}>System Logs</h4>
      <div className="text-muted mb-3 small">Auto-written log entries for key actions (user registration, case creation, verification).</div>
      <InputGroup className="mb-3" style={{ maxWidth: 400 }}>
        <InputGroup.Text>🔍</InputGroup.Text>
        <Form.Control placeholder="Search logs…" value={searchLog} onChange={e => setSearchLog(e.target.value)} />
      </InputGroup>
      {loading.logs && <div className="text-center py-5"><Spinner /></div>}
      {errors.logs && <Alert variant="danger">{errors.logs}</Alert>}
      <div className="table-responsive">
        <Table hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Action</th>
              <th>Description</th>
              <th>Entity</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {!loading.logs && filteredLogs.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted py-4">No logs yet. New registrations and case actions will appear here.</td></tr>
            )}
            {filteredLogs.map(l => (
              <tr key={l.logid}>
                <td><Badge bg="secondary">{l.actiontype}</Badge></td>
                <td>{l.description}</td>
                <td className="text-muted small">{l.entitytype}</td>
                <td>{statusBadge(l.status)}</td>
                <td className="text-muted small">{fmtDateTime(l.actiontimestamp)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );

  const ApprovalsPage = () => (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#22304a' }}>Pending Approvals</h4>
      <div className="text-muted mb-3 small">
        Judge and Court Registrar signups need approval before they can log in.
      </div>
      {actionMsg && (
        <Alert variant={actionMsg.type} dismissible onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}
      <div className="table-responsive">
        <Table hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>CNIC</th>
              <th>Role</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading.pending && <LoadingRow cols={7} />}
            {errors.pending && <ErrorRow cols={7} msg={errors.pending} />}
            {!loading.pending && !errors.pending && pending.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted py-4">No pending requests.</td></tr>
            )}
            {pending.map(p => (
              <tr key={p.userid}>
                <td>{p.name}</td>
                <td>{p.email}</td>
                <td>{p.phone || '—'}</td>
                <td>{p.cnic || '—'}</td>
                <td>{roleBadge(p.role)}</td>
                <td>{fmtDate(p.requestedAt)}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="success" onClick={() => startApproval(p)}>Approve</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => handleApproval(p, 'reject')}>Reject</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );

  const filteredCourts = courts.filter(c =>
    [c.courtname, c.type, c.location, c.registrarName].join(' ').toLowerCase().includes(searchCourtMgmt.toLowerCase())
  );

  const CourtsPage = () => (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0" style={{ color: '#22304a' }}>Manage Courts</h4>
        <Button size="sm" variant="primary" className="d-flex align-items-center gap-1" onClick={() => setAddCourtModal({ show: true, name: '', type: '', location: '', error: null, submitting: false })}>
          <Plus size={16} /> Add Court
        </Button>
      </div>
      <div className="text-muted mb-3 small">
        The authoritative list of courts in the system. A CourtRegistrar applicant gets assigned
        one of these during approval — courts are never created as a side effect of that.
      </div>
      {actionMsg && (
        <Alert variant={actionMsg.type} dismissible onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}
      <InputGroup className="mb-3" style={{ maxWidth: 400 }}>
        <InputGroup.Text>🔍</InputGroup.Text>
        <Form.Control placeholder="Search courts…" value={searchCourtMgmt} onChange={e => setSearchCourtMgmt(e.target.value)} />
      </InputGroup>
      <div className="table-responsive">
        <Table hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Court Name</th>
              <th>Type</th>
              <th>Location</th>
              <th>Registrar</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading.courts && <LoadingRow cols={5} />}
            {errors.courts && <ErrorRow cols={5} msg={errors.courts} />}
            {!loading.courts && !errors.courts && filteredCourts.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted py-4">No courts yet.</td></tr>
            )}
            {filteredCourts.map(c => (
              <tr key={c.id}>
                <td>{c.courtname}</td>
                <td>{c.type}</td>
                <td>{c.location}</td>
                <td>{c.registrarName ? c.registrarName : <span className="text-muted">Unclaimed</span>}</td>
                <td>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    disabled={!!c.registrarName}
                    title={c.registrarName ? 'Unassign the registrar before deleting' : 'Delete court'}
                    onClick={() => setDeleteCourtModal({ show: true, court: c })}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );

  const pageMap = {
    overview: <Overview />,
    approvals: <ApprovalsPage />,
    courts: <CourtsPage />,
    users: <UsersPage />,
    cases: <CasesPage />,
    logs: <LogsPage />,
  };

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f0f2f5', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, #22304a 0%, #1ec6b6 100%)', padding: '12px 24px', flexShrink: 0 }}>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Court Central</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>|</span>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>Admin Dashboard</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>|</span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{adminData.username}</span>
          </div>
          <button
            className="btn btn-sm"
            onClick={handleLogout}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: 200, background: '#22304a', flexShrink: 0, paddingTop: 16 }}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setActivePage(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '12px 20px', border: 'none', textAlign: 'left',
                background: activePage === item.key ? 'rgba(30,198,182,0.2)' : 'transparent',
                borderLeft: activePage === item.key ? '3px solid #1ec6b6' : '3px solid transparent',
                color: activePage === item.key ? '#1ec6b6' : 'rgba(255,255,255,0.7)',
                fontWeight: activePage === item.key ? 600 : 400,
                cursor: 'pointer', fontSize: 14,
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
            <Card.Body style={{ padding: 24 }}>
              {pageMap[activePage]}
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Delete confirm modal */}
      <Modal show={deleteModal.show} onHide={() => setDeleteModal({ show: false, user: null })} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to permanently delete <strong>{deleteModal.user?.name}</strong> ({deleteModal.user?.role})?
          This cannot be undone and will remove all their associated records.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteModal({ show: false, user: null })}>Cancel</Button>
          <Button variant="danger" onClick={confirmDeleteUser}>Delete</Button>
        </Modal.Footer>
      </Modal>

      {/* Court assignment modal — required to approve a CourtRegistrar.
          Courts themselves are only ever created on Manage Courts. */}
      <Modal
        show={courtAssignModal.show}
        onHide={() => setCourtAssignModal({ show: false, user: null, courtid: '' })}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Assign a Court — {courtAssignModal.user?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Pick an existing unclaimed court for this registrar to run. Each
            court can only have one registrar. Need a new court first? Add it
            on the Manage Courts page, then come back here.
          </p>
          {courtAssignError && <Alert variant="danger">{courtAssignError}</Alert>}

          {loadingUnclaimedCourts ? (
            <div className="text-center py-3"><Spinner size="sm" /></div>
          ) : unclaimedCourts.length === 0 ? (
            <div className="text-muted small">No unclaimed courts available — add one on the Manage Courts page first.</div>
          ) : (
            <Form.Select
              value={courtAssignModal.courtid}
              onChange={e => setCourtAssignModal(p => ({ ...p, courtid: e.target.value }))}
            >
              <option value="">Select a court…</option>
              {unclaimedCourts.map(c => (
                <option key={c.id} value={c.id}>{c.courtname} — {c.type} — {c.location}</option>
              ))}
            </Form.Select>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setCourtAssignModal({ show: false, user: null, courtid: '' })}>
            Cancel
          </Button>
          <Button variant="success" onClick={submitCourtAssignApproval} disabled={courtAssignSubmitting || unclaimedCourts.length === 0}>
            {courtAssignSubmitting ? <Spinner size="sm" animation="border" /> : 'Approve & Assign'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add Court modal (Manage Courts page) */}
      <Modal show={addCourtModal.show} onHide={() => setAddCourtModal({ show: false, name: '', type: '', location: '', error: null, submitting: false })} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add Court</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addCourtModal.error && <Alert variant="danger">{addCourtModal.error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Court Name</Form.Label>
            <Form.Control
              value={addCourtModal.name}
              onChange={e => setAddCourtModal(p => ({ ...p, name: e.target.value }))}
              placeholder="Enter court name"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Address / Location</Form.Label>
            <Form.Control
              value={addCourtModal.location}
              onChange={e => setAddCourtModal(p => ({ ...p, location: e.target.value }))}
              placeholder="Enter court address"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Court Type</Form.Label>
            <Form.Select
              value={addCourtModal.type}
              onChange={e => setAddCourtModal(p => ({ ...p, type: e.target.value }))}
            >
              <option value="">Select court type</option>
              <option value="Supreme Court">Supreme Court</option>
              <option value="High Court">High Court</option>
              <option value="District Court">District Court</option>
              <option value="Magistrate Court">Magistrate Court</option>
              <option value="Special Court">Special Court</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setAddCourtModal({ show: false, name: '', type: '', location: '', error: null, submitting: false })}>Cancel</Button>
          <Button variant="primary" onClick={submitAddCourt} disabled={addCourtModal.submitting}>
            {addCourtModal.submitting ? <Spinner size="sm" animation="border" /> : 'Add Court'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Court confirm modal */}
      <Modal show={deleteCourtModal.show} onHide={() => setDeleteCourtModal({ show: false, court: null })} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Court</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete <strong>{deleteCourtModal.court?.courtname}</strong>?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteCourtModal({ show: false, court: null })}>Cancel</Button>
          <Button variant="danger" onClick={confirmDeleteCourt}>Delete</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
