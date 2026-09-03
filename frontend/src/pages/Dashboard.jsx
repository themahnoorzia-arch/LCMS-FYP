import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Card, Row, Col, InputGroup, Form, Button, Badge, Table, Modal } from 'react-bootstrap';
import { User, PlusCircle, Search, LogOut } from 'lucide-react';
import SidebarNav from '../components/dashboard/SidebarNav';
import CalendarSummary from '../components/dashboard/CalendarSummary';
import Notifications from '../components/dashboard/Notifications';
import Billing from '../components/dashboard/Billing';
import Appeals from '../components/dashboard/Appeals';
import Evidence from './Evidence.jsx';
import Witnesses from './Witnesses.jsx';

const PROFILE_IMAGE_KEY = 'lawyerProfileImage';

// Lets a lawyer search for and pick an already-registered client instead of
// typing a free-text name (which used to silently create a fake account for
// any name that didn't match an existing user).
const ClientPicker = ({ selected, onSelect }) => {
  const [search, setSearchText] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`/api/clients?query=${encodeURIComponent(search.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      setResults(Array.isArray(data.clients) ? data.clients : []);
    } catch (err) {
      console.error('Error searching clients:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  if (selected) {
    return (
      <div className="d-flex align-items-center justify-content-between border rounded p-2">
        <span>
          <strong>{selected.name}</strong>
          {selected.cnic ? ` (CNIC: ${selected.cnic})` : ''}
        </span>
        <Button size="sm" variant="link" onClick={() => onSelect(null)}>Change</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex gap-2 mb-2">
        <Form.Control
          type="text"
          placeholder="Search registered client by name or CNIC"
          value={search}
          onChange={e => setSearchText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
        />
        <Button variant="outline-primary" onClick={runSearch} disabled={searching}>
          {searching ? '...' : 'Search'}
        </Button>
      </div>
      {results.length > 0 ? (
        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
          {results.map(c => (
            <div key={c.participantid} className="d-flex align-items-center justify-content-between p-2 border rounded mb-1">
              <span>{c.name}{c.cnic ? ` (CNIC: ${c.cnic})` : ''}</span>
              <Button size="sm" variant="outline-primary" onClick={() => { onSelect(c); setResults([]); setSearchText(''); }}>Select</Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted small">Search for a client who has already signed up in the system.</div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const [activeView, setActiveView] = useState('cases');
  const [profileImage, setProfileImage] = useState(null);
  const [lawyerData, setLawyerData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fallbackWarning, setFallbackWarning] = useState('');
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [caseHistory, setCaseHistory] = useState([]);
  const [caseForm, setCaseForm] = useState({
    title: '',
    description: '',
    caseType: '',
    clientName: '',
    courtName: '',
    side: 'Petitioner',
  });
  const [courts, setCourts] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinSearch, setJoinSearch] = useState("");
  const [joinResults, setJoinResults] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [joinSide, setJoinSide] = useState("");
  const [selectedJoinClient, setSelectedJoinClient] = useState(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCase, setHistoryCase] = useState(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionCase, setDecisionCase] = useState(null);

  const filteredCases = cases.filter(case_ => {
    const matchesSearch =
      (case_.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (case_.caseType || '').toLowerCase().includes(search.toLowerCase()) ||
      (case_.description || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = status === 'All' || case_.status === status;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const res = await fetch('/api/courts', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
          },
          credentials: 'include',
        });
        if (!res.ok) return;
        const d = await res.json();
        if (d && d.success && Array.isArray(d.courts)) setCourts(d.courts);
      } catch (err) {
        console.error('Failed to fetch courts', err);
      }
    };

    fetchCourts();

    const fetchLawyerData = async () => {
      try {
        const response = await fetch('/api/dashboard', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
          },
          credentials: 'include',
        });

        if (!response.ok) throw new Error('Failed to fetch lawyer data');

        const result = await response.json();

        if (result.success) {
          setLawyerData(result.user);
          const storedImage = localStorage.getItem(PROFILE_IMAGE_KEY);
          setProfileImage(storedImage || 'https://placehold.co/150');

          const paymentRes = await fetch('/api/payments', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
            },
            credentials: 'include',
          });

          if (paymentRes.ok) {
            const paymentData = await paymentRes.json();
            if (paymentData.status === 'success') {
              setPayments(paymentData.payments);
            }
          }
        } else {
          setError('Failed to load user data.');
        }
      } catch (err) {
        setError('Could not load dashboard data from the server.');
      }
    };

    const fetchCases = async () => {
  try {
    const res = await fetch('/api/cases', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
      },
      credentials: 'include',
    });

    if (!res.ok) throw new Error('Failed to fetch cases');

    const data = await res.json();
    const caseList = Array.isArray(data.cases)
      ? data.cases
      : Array.isArray(data)
        ? data
        : null;

    if (caseList) {
      const normalizedCases = caseList.map(c => ({
        id: c.caseid,
        title: c.title,
        description: c.description,
        caseType: c.casetype,
        filingDate: c.filingdate,
        status: c.status,
        clientName: c.clientname || 'N/A',
        courtName: c.courtname || 'N/A',
        judgeName: c.judgeName || 'N/A',
        decisionDate: c.decisiondate || '',
        decisionSummary: c.decisionsummary || '',
        verdict: c.verdict || '',
        history: c.history || [],
        prosecutor: c.prosecutorName || c.prosecutor || 'N/A',
        myAccessStatus: (c.myaccessstatus || 'approved').toLowerCase(),
        mySide: c.myside || '',
      }));
      setCases(normalizedCases);
    } else {
      throw new Error('Invalid response structure');
    }
  } catch (err) {
    setFallbackWarning('Could not load cases from the server.');
    setCases([]);
  } finally {
    setLoading(false);
  }
};

    fetchLawyerData();
    fetchCases();
  }, []);

  const handleProfileClick = () => navigate('/profile');

  const createPayment = async (newPayment) => {
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
        },
        credentials: 'include',
        body: JSON.stringify(newPayment),
      });

      const result = await res.json();

      if (res.ok && result.message) {
        const addedPayment = {
          paymentdate: newPayment.paymentdate || new Date().toISOString().split('T')[0],
          casename: newPayment.casename,
          purpose: newPayment.purpose,
          balance: newPayment.balance,
          mode: newPayment.mode
        };

        setPayments(prev => [...prev, addedPayment]);
      }
    } catch (error) {
      console.error('Error creating payment:', error);
    }
  };
const handleCaseSubmit = async (e) => {
    e.preventDefault(); // Prevent the default form submission
    const token = localStorage.getItem('userToken');

    if (!editingCase && !selectedClient) {
      alert('Please search for and select the client this case is for.');
      return;
    }

    const caseData = {
      title: caseForm.title,
      description: caseForm.description,
      casetype: caseForm.caseType,
      courtname: caseForm.courtName,
      // casenumber removed from lawyer submission; registrar assigns case numbers
      side: caseForm.side,
      ...(editingCase ? {} : { participantId: selectedClient?.participantid, clientName: selectedClient?.name }),
    };

    try {
      let res;

      // Note: Duplicate-check by case number removed from lawyer submission.

      if (editingCase) {
        res = await fetch(`/api/cases/${editingCase.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(caseData),
        });
      } else {
        res = await fetch('/api/cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify(caseData),
        });
      }

      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData?.message || 'Failed to submit the case');
      }
      const data = responseData;

      if (editingCase) {
      // Update the case in the state if editing
      setCases(prevCases =>
        prevCases.map(c => (c.id === editingCase.id ? { ...c, ...caseData } : c))
      );
    } else {
      // Add the new case to the state if it's a new case
        const addedCase = {
          id: data.case_id,
          title: caseForm.title,
          description: caseForm.description,
          caseType: caseForm.caseType,
          clientName: selectedClient?.name || 'N/A',
          courtName: caseForm.courtName || 'N/A',
          judgeName: 'N/A',
          prosecutor: 'N/A',
          status: 'Pending',
          filingDate: new Date().toISOString().split('T')[0],
          history: [],
        };

        setCases([addedCase, ...cases]);
    }

    // Close the modal and reset the form
    setShowCaseModal(false);
    setEditingCase(null);
    setSelectedClient(null);
    setCaseForm({
      title: '',
      description: '',
      caseType: '',
      clientName: '',
      courtName: '',
      side: 'Petitioner',
    });

  } catch (err) {
    console.error('Error submitting case:', err);
    alert(err.message || 'Failed to submit the case');
  }
};



  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const renderContent = () => {
    switch (activeView) {
      case 'cases':
        return (
          <Card className="mb-4">
            <Card.Header className="bg-white border-bottom-0 pb-0">
              <div className="d-flex align-items-center gap-3 mb-2">
                <h4 className="mb-0 fw-bold"><span className="me-2" role="img" aria-label="cases">📋</span>My Cases</h4>
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="d-flex align-items-center gap-2"
                  onClick={() => { setEditingCase(null); setSelectedClient(null); setShowCaseModal(true); }}
                >
                  <PlusCircle size={16} /> Request New Case Filing
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="d-flex align-items-center gap-2"
                  onClick={() => setShowJoinModal(true)}
                >
                  <PlusCircle size={16} /> Join Existing Case
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="pt-0">
              <Row className="g-2 mb-3">
                <Col md={8}>
                  <InputGroup>
                    <InputGroup.Text><Search size={16} /></InputGroup.Text>
                    <Form.Control
                      placeholder="Search by case name, type, or description..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </InputGroup>
                </Col>
                <Col md={4}>
                  <Form.Select value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="All">All Statuses</option>
                    <option value="Open">Open</option>
                    <option value="Pending">Pending</option>
                    <option value="Closed">Closed</option>
                  </Form.Select>
                </Col>
              </Row>
              <div className="table-responsive" style={{ maxHeight: 420, overflowY: 'auto' }}>
                <Table hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Case Name</th>
                      <th>Type</th>
                      <th>Filing Date</th>
                      <th>Client</th>
                      <th>Prosecutor</th>
                      <th>Court</th>
                      <th>Judge</th>
                      <th>Status</th>
                      <th>Your Access</th>
                      <th>Final Decision</th>
                      <th>Case History</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="text-center text-muted py-4">No cases found.</td>
                      </tr>
                    ) : (
                      filteredCases.map((case_) => {
                        const isPending = case_.myAccessStatus === 'pending';
                        return (
                          <tr key={case_.id}>
                            <td>{case_.title}</td>
                            <td>{case_.caseType}</td>
                            <td>{case_.filingDate}</td>
                            <td>{case_.clientName}</td>
                            <td>{case_.prosecutor}</td>
                            <td>{case_.courtName}</td>
                            <td>{case_.judgeName}</td>
                            <td>
                              <Badge bg={
                                case_.status === 'Open' ? 'success' :
                                case_.status === 'Pending' ? 'warning' :
                                'secondary'
                              } className="px-3 py-1 fs-6">
                                {case_.status}
                              </Badge>
                            </td>
                            <td>
                              {isPending ? (
                                <Badge bg="warning" text="dark">Pending Approval</Badge>
                              ) : (
                                <Badge bg="success">Approved</Badge>
                              )}
                            </td>
<td>
  {case_.status === 'Closed' && (case_.decisionDate || case_.decisionSummary || case_.verdict) ? (
    <Button
      variant="link"
      size="sm"
      onClick={() => {
        setDecisionCase(case_);
        setShowDecisionModal(true);
      }}
    >
      View
    </Button>
  ) : (
    <span className="text-muted">-</span>
  )}
</td>

                            <td>
                              <Button variant="link" size="sm" onClick={() => { setHistoryCase(case_); setShowHistoryModal(true); }}>View</Button>
                            </td>
                            <td>
                              {isPending ? (
                                <span className="text-muted">-</span>
                              ) : (
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => {
                                    setEditingCase(case_);
                                    setCaseForm(case_);
                                    setShowCaseModal(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        );
      case 'calendar':
        return <CalendarSummary />;
      case 'billing':
        return <Billing payments={payments} onCreatePayment={createPayment} />;
      case 'appeals':
        return <Appeals />;
      case 'evidence':
        return <Evidence />;
      case 'witnesses':
        return <Witnesses />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', overflow: 'hidden', background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
      {fallbackWarning && (
        <div className="alert alert-warning text-center">{fallbackWarning}</div>
      )}
      <div className="dashboard-header-gradient p-3" style={{ flex: '0 0 auto', background: 'linear-gradient(90deg, #22304a 0%, #1ec6b6 100%)' }}>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <h4 className="mb-0" style={{ color: '#fff', fontWeight: 700 }}>Lawyer Dashboard</h4>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>|</span>
            <div className="d-flex align-items-center gap-2">
              <Image
                src={profileImage}
                roundedCircle
                width={40}
                height={40}
                className="border"
                style={{ borderColor: '#fff' }}
              />
              <div>
                <h6 className="mb-0" style={{ color: '#fff', fontWeight: 600 }}>{lawyerData?.username}</h6>
                <small style={{ color: 'rgba(255,255,255,0.85)' }}>{lawyerData?.specialization}</small>
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <Notifications color="#fff" />
            <button
              className="btn btn-outline-primary d-flex align-items-center gap-2"
              onClick={handleProfileClick}
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: '#fff', fontWeight: 600 }}
            >
              <User size={20} color="#fff" />
              Profile
            </button>
            <button
              className="btn btn-outline-danger d-flex align-items-center gap-2 logout-btn"
              onClick={handleLogout}
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: '#fff', fontWeight: 600 }}
            >
              <LogOut size={20} color="#fff" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: '1 1 0', display: 'flex', width: '100%', height: '100%', minHeight: 0 }}>
        <div className="border-end bg-white" style={{ width: '250px', height: '100%', minHeight: 0, flex: '0 0 250px' }}>
          <SidebarNav activeView={activeView} onViewChange={setActiveView} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {renderContent()}
        </div>
      </div>

      <Modal show={showCaseModal} onHide={() => setShowCaseModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingCase ? 'Edit Case' : 'Add New Case'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCaseSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Case Title</Form.Label>
              <Form.Control
                type="text"
                value={caseForm.title}
                onChange={e => setCaseForm({ ...caseForm, title: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={caseForm.description}
                onChange={e => setCaseForm({ ...caseForm, description: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Case Type</Form.Label>
              <Form.Select
                value={caseForm.caseType}
                onChange={e => setCaseForm({ ...caseForm, caseType: e.target.value })}
                required
              >
                <option value="">Select type</option>
                <option value="Criminal">Criminal</option>
                <option value="Civil">Civil</option>
                <option value="Family">Family</option>
                <option value="Corporate">Corporate</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Client</Form.Label>
              {editingCase ? (
                <Form.Control type="text" value={caseForm.clientName} disabled readOnly />
              ) : (
                <ClientPicker selected={selectedClient} onSelect={setSelectedClient} />
              )}
            </Form.Group>
            {/* Case Number removed from lawyer filing form; registrar assigns numbers on verification */}
            <Form.Group className="mb-3">
              <Form.Label>Side</Form.Label>
              <Form.Select
                value={caseForm.side}
                onChange={e => setCaseForm({ ...caseForm, side: e.target.value })}
                required
              >
                <option value="Petitioner">Petitioner</option>
                <option value="Respondent">Respondent</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Court Name</Form.Label>
              {courts && courts.length > 0 ? (
                <Form.Select
                  value={caseForm.courtName}
                  onChange={e => setCaseForm({ ...caseForm, courtName: e.target.value })}
                  required
                >
                  <option value="">Select court</option>
                  {courts.map(c => (
                    <option key={c.id} value={c.courtname}>{c.courtname}</option>
                  ))}
                </Form.Select>
              ) : (
                <Form.Control
                  type="text"
                  value={caseForm.courtName}
                  onChange={e => setCaseForm({ ...caseForm, courtName: e.target.value })}
                  placeholder="Enter court name"
                  required
                />
              )}
            </Form.Group>

          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowCaseModal(false); setSelectedClient(null); }}>Cancel</Button>
            <Button variant="primary" type="submit">{editingCase ? 'Update' : 'Add'} Case</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showJoinModal} onHide={() => setShowJoinModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Join Existing Case</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3 d-flex gap-2">
            <Form.Control
              type="text"
              placeholder="Search by case number or title"
              value={joinSearch}
              onChange={e => setJoinSearch(e.target.value)}
            />
            <Button variant="primary" onClick={async () => {
              try {
                const token = localStorage.getItem('userToken');
                const res = await fetch(`/api/cases/check-duplicate?query=${encodeURIComponent(joinSearch)}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  credentials: 'include',
                });
                const data = await res.json();
                const results = data.matches || data || [];
                setJoinResults(Array.isArray(results) ? results : []);
              } catch (err) {
                console.error('Error searching cases:', err);
              }
            }}>Search</Button>
          </Form.Group>

          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {joinResults.length === 0 ? (
              <div className="text-muted">No results.</div>
            ) : (
              joinResults.map(r => (
                <div key={r.caseid} className="d-flex align-items-center justify-content-between mb-2 p-2 border rounded">
                  <div>
                    <div><strong>{r.title || r.casename || 'Untitled'}</strong></div>
                    <div className="text-muted">{r.casenumber || r.caseno || ''}</div>
                    {Array.isArray(r.lawyers) && r.lawyers.length > 0 && (
                      <div className="text-muted small">
                        Already on this case: {r.lawyers.map(lw => `${lw.name || 'N/A'} (${lw.side ? lw.side[0].toUpperCase() + lw.side.slice(1) : 'Unknown side'})`).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Button size="sm" variant="outline-primary" onClick={() => { setSelectedCase(r); setJoinSide(''); setSelectedJoinClient(null); }}>Select</Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedCase && (
            <div className="mt-3">
              <div className="mb-2"><strong>Selected:</strong> {selectedCase.title} — {selectedCase.casenumber}</div>
              <Form.Group className="mb-3">
                <Form.Label>Select side</Form.Label>
                <Form.Select value={joinSide} onChange={e => setJoinSide(e.target.value)}>
                  <option value="">Select side</option>
                  <option value="Petitioner">Petitioner</option>
                  <option value="Respondent">Respondent</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Your Client</Form.Label>
                <ClientPicker selected={selectedJoinClient} onSelect={setSelectedJoinClient} />
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowJoinModal(false); setSelectedJoinClient(null); }}>Cancel</Button>
          <Button variant="primary" onClick={async () => {
            if (!selectedCase || !joinSide) return alert('Select a case and side first');
            if (!selectedJoinClient) return alert('Please search for and select the client you represent');
            try {
              const token = localStorage.getItem('userToken');
              const res = await fetch('/api/cases/join-request', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                credentials: 'include',
                body: JSON.stringify({ caseid: selectedCase.caseid, side: joinSide, participantId: selectedJoinClient.participantid }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data?.message || 'Failed to join case');
              setShowJoinModal(false);
              setJoinSearch('');
              setJoinResults([]);
              setSelectedCase(null);
              setJoinSide('');
              setSelectedJoinClient(null);
              alert(data?.message || 'Join request sent. Waiting for registrar approval.');
              fetchCases();
            } catch (err) {
              console.error('Error joining case:', err);
              alert(err.message || 'Failed to join case');
            }
          }}>Confirm Join</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDecisionModal} onHide={() => setShowDecisionModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Final Decision</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {decisionCase && (
            <>
              <div><strong>Decision Date:</strong> {decisionCase.decisionDate || '-'}</div>
              <div><strong>Summary:</strong> {decisionCase.decisionSummary || '-'}</div>
              <div><strong>Verdict:</strong> {decisionCase.verdict || '-'}</div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDecisionModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
<Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} centered>
  <Modal.Header closeButton>
    <Modal.Title>Case History</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    {historyCase?.history?.length > 0 ? (
      <ul>
        {historyCase.history.map((h, idx) => (
          <li key={idx}><strong>{h.date}:</strong> {h.event}</li>
        ))}
      </ul>
    ) : (
      <div className="text-center text-muted">No history available for this case.</div>
    )}
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>Close</Button>
  </Modal.Footer>
</Modal>


      <style>{`
        .dashboard-heading, .dashboard-gradient, .modal-title, .card-title, .card-header h4, .card-header h5, h4.fw-bold, h5.fw-bold {
          background: linear-gradient(90deg, #22304a 0%, #1ec6b6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-fill-color: transparent;
        }
        .btn-primary, .btn-outline-primary, .btn-link, .btn-info, .btn-success, .btn-warning {
          background: #1ec6b6 !important;
          border-color: #1ec6b6 !important;
          color: #fff !important;
        }
        .btn-primary:hover, .btn-outline-primary:hover, .btn-link:hover, .btn-info:hover, .btn-success:hover, .btn-warning:hover {
          background: #159e8c !important;
          border-color: #159e8c !important;
          color: #fff !important;
        }
        .badge-success, .badge-info, .badge-warning, .badge-secondary {
          background: #1ec6b6 !important;
          color: #fff !important;
        }
        .table thead th {
          color: #22304a !important;
          font-weight: 700;
        }
        .text-primary, .text-info, .text-success, .text-warning, .text-secondary {
          color: #1ec6b6 !important;
        }
        .text-muted {
          color: #6c757d !important;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;