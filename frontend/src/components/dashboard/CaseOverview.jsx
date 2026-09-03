import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Row,
  Col,
  Form,
  InputGroup,
  Table,
  Card,
  Badge,
  Modal,
  Button,
} from 'react-bootstrap';
import { Search, FunnelFill } from 'react-bootstrap-icons';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const getCases = () => [
  {
    id: 'case1',
    caseName: 'Smith v. Jones Construction LLC',
    client: 'Johnathan P. Smith',
    opposingCounsel: 'Jane R. Doe, Esq.',
    status: 'Open',
    lastActivity: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    caseType: 'Civil Litigation',
    court: 'Superior Court, Anytown',
    priority: 'High',
    decisionDate: '',
    decisionSummary: '',
    verdict: '',
  },
  {
    id: 'case2',
    caseName: 'Acme Corp v. Beta Innovations Inc.',
    client: 'Acme Corporation (Rep: T. Stark)',
    opposingCounsel: 'Robert "Bob" Paulson III',
    status: 'Pending Discovery',
    lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    caseType: 'Intellectual Property',
    court: 'Federal District Court',
    priority: 'Medium',
    decisionDate: '',
    decisionSummary: '',
    verdict: '',
  },
  {
    id: 'case3',
    caseName: 'State of Confusion v. Michael "Mikey" Miller',
    client: 'Michael Miller (Pro Bono)',
    opposingCounsel: "District Attorney's Office",
    status: 'In Trial',
    lastActivity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    caseType: 'Criminal Defense',
    court: 'Criminal Court, Div A',
    priority: 'Critical',
    decisionDate: '',
    decisionSummary: '',
    verdict: '',
  },
  {
    id: 'case4',
    caseName: 'Chen Family Living Trust Admin',
    client: 'Sarah Chen & Family',
    opposingCounsel: 'N/A (Estate Planning)',
    status: 'Closed - Archived',
    lastActivity: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    caseType: 'Estate Planning',
    court: 'N/A',
    priority: 'Low',
    decisionDate: '',
    decisionSummary: '',
    verdict: '',
  },
  {
    id: 'case5',
    caseName: 'Innovate LLC Patent Dispute',
    client: 'Innovate Dynamics LLC',
    opposingCounsel: 'Global Tech Law Group LLP',
    status: 'Open',
    lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    caseType: 'Patent Litigation',
    court: 'USPTO PTAB',
    priority: 'High',
    decisionDate: '',
    decisionSummary: '',
    verdict: '',
  },
  {
    id: 'case6',
    caseName: 'Real Estate Transaction - Miller Property',
    client: 'The Miller Family',
    opposingCounsel: "Buyer's Counsel",
    status: 'Pending Closing',
    lastActivity: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    caseType: 'Real Estate',
    court: 'N/A',
    priority: 'Medium',
    decisionDate: '',
    decisionSummary: '',
    verdict: '',
  },
];

const mockCases = [
  { id: 'case1', title: 'Mock Case 1', description: 'Fallback description', casetype: 'Civil', filingdate: '2024-06-01', status: 'Open', decisionDate: '', decisionSummary: '', verdict: '' },
  { id: 'case2', title: 'Mock Case 2', description: 'Another fallback', casetype: 'Criminal', filingdate: '2024-06-02', status: 'Closed', decisionDate: '', decisionSummary: '', verdict: '' },
];

const CaseOverview = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortKey, setSortKey] = useState('lastActivity');
  const [sortDirection, setSortDirection] = useState('desc');
  const [activityDates, setActivityDates] = useState({});
  const [fallbackWarning, setFallbackWarning] = useState("");
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionData, setDecisionData] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const fetchedCases = getCases();
      setCases(fetchedCases);
      const dates = {};
      fetchedCases.forEach((c) => {
        dates[c.id] = c.filingdate || format(new Date(), 'MM/dd/yyyy');
      });
      setActivityDates(dates);
      setLoading(false);
    } catch (err) {
      setFallbackWarning("Backend unavailable, showing mock case data.");
      setCases(mockCases);
      setLoading(false);
    }
  }, []);

  const handleSort = (key) => {
    if (!key) return;

    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedCases = useMemo(() => {
    let filtered = cases.filter((c) => {
      const searchText = filterText.toLowerCase();
      const matchesText =
        c.caseName.toLowerCase().includes(searchText) ||
        c.client.toLowerCase().includes(searchText) ||
        (c.opposingCounsel &&
          c.opposingCounsel.toLowerCase().includes(searchText)) ||
        c.caseType.toLowerCase().includes(searchText);

      const matchesStatus =
        filterStatus === 'All' || c.status === filterStatus;

      return matchesText && matchesStatus;
    });

    if (sortKey) {
      filtered.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        let comparison = 0;
        if (valA instanceof Date && valB instanceof Date) {
          comparison = valA.getTime() - valB.getTime();
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (valA > valB) {
          comparison = 1;
        } else if (valA < valB) {
          comparison = -1;
        }

        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [cases, filterText, filterStatus, sortKey, sortDirection]);

  const getStatusBadgeVariant = (status) => {
    if (status.toLowerCase().includes('open')) return 'primary';
    if (status.toLowerCase().includes('pending')) return 'warning';
    if (status.toLowerCase().includes('trial')) return 'danger';
    if (status.toLowerCase().includes('closed')) return 'secondary';
    return 'info';
  };

  const allStatuses = useMemo(() => {
    const uniqueStatuses = new Set(cases.map((c) => c.status));
    return ['All', ...Array.from(uniqueStatuses)];
  }, [cases]);

  return (
    <Container fluid className="py-4">
      <Card className="mb-4 shadow">
        <Card.Header as="h5">My Cases</Card.Header>
        <Card.Body>
          <Row className="mb-3">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <Search />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search cases, clients, counsel..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <FunnelFill />
                </InputGroup.Text>
                <Form.Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  {allStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status === 'All' ? 'All Statuses' : status}
                    </option>
                  ))}
                </Form.Select>
              </InputGroup>
            </Col>
          </Row>

          {fallbackWarning && (
            <div className="alert alert-warning text-center">{fallbackWarning}</div>
          )}

          <div className="table-responsive">
            <Table bordered hover striped>
              <thead className="table-light">
                <tr>
                  <th onClick={() => handleSort('title')}>Title</th>
                  <th onClick={() => handleSort('description')}>Description</th>
                  <th onClick={() => handleSort('casetype')}>Case Type</th>
                  <th onClick={() => handleSort('filingdate')}>Filing Date</th>
                  <th onClick={() => handleSort('status')}>Status</th>
                  <th>Final Decision</th>
                  <th>Case History</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted">
                      Loading cases...
                    </td>
                  </tr>
                ) : filteredAndSortedCases.length > 0 ? (
                  filteredAndSortedCases.map((c) => (
                    <tr key={c.id}>
                      <td>{c.title}</td>
                      <td>{c.description}</td>
                      <td>{c.casetype}</td>
                      <td>{c.filingdate}</td>
                      <td>
                        <Badge bg={getStatusBadgeVariant(c.status)}>
                          {c.status}
                        </Badge>
                      </td>
                      <td>
                        {c.status && c.status.toLowerCase().includes('closed') ? (
                          <button className="btn btn-link p-0" onClick={() => { setDecisionData(c); setShowDecisionModal(true); }}>
                            View Final Decision
                          </button>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-link p-0" onClick={() => navigate(`/case-history/${c.id}`)}>
                          View History
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-primary me-1">Edit</button>
                        <button className="btn btn-sm btn-info me-1">View</button>
                        <button className="btn btn-sm btn-secondary">Download</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center text-muted">
                      No cases found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
      <Modal show={showDecisionModal} onHide={() => setShowDecisionModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Final Decision</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div><strong>Decision Date:</strong> {decisionData.decisionDate || '-'}</div>
          <div><strong>Summary:</strong> {decisionData.decisionSummary || '-'}</div>
          <div><strong>Verdict:</strong> {decisionData.verdict || '-'}</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDecisionModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default CaseOverview;
