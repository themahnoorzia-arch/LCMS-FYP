import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Button, Modal, Form, Spinner } from 'react-bootstrap';
import RecordDetailsModal from '../components/RecordDetailsModal';
import { downloadRecord } from '../utils/recordActions';

function normalizeWitnessesResponse(data) {
  const list = Array.isArray(data) ? data : data?.witnesses || [];
  const rows = [];

  list.forEach((item) => {
    const w = item.witness || item;
    if (!w) return;

    const cases = item.cases || [];
    if (cases.length === 0) {
      rows.push({
        id: w.id ?? w.witnessid,
        firstName: w.firstname || w.firstName || '',
        lastName: w.lastname || w.lastName || '',
        cnic: w.cnic || '',
        phone: w.phone || '',
        email: w.email || '',
        address: w.address || '',
        pasthistory: w.pasthistory || '',
        caseName: item.case_id ? `Case #${item.case_id}` : 'N/A',
        statement: item.statement || '',
        statementDate: item.statementdate || item.statementDate || '',
      });
      return;
    }

    cases.forEach((c) => {
      rows.push({
        id: `${w.id ?? w.witnessid}-${c.caseid}`,
        witnessId: w.id ?? w.witnessid,
        caseid: c.caseid,
        firstName: w.firstname || w.firstName || '',
        lastName: w.lastname || w.lastName || '',
        cnic: w.cnic || '',
        phone: w.phone || '',
        email: w.email || '',
        address: w.address || '',
        pasthistory: w.pasthistory || '',
        caseName: c.title || (c.caseid ? `Case #${c.caseid}` : 'N/A'),
        statement: c.statement || item.statement || '',
        statementDate: c.statementdate || item.statementdate || '',
      });
    });
  });

  return rows;
}

const Witnesses = () => {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', cnic: '', phone: '',
    email: '', address: '', pasthistory: '',
    caseName: '', statement: '', statementDate: ''
  });
  const [witnesses, setWitnesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/witnesses', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to fetch witnesses');
        }
        return response.json();
      })
      .then((data) => {
        setWitnesses(normalizeWitnessesResponse(data));
        setError('');
      })
      .catch((err) => {
        console.error('Error fetching witnesses:', err);
        setError(err.message);
        setWitnesses([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(editing ? `/api/witnesses/${editing.witnessId}/${editing.caseid}` : '/api/witnesses', {
        method: editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: form.firstName, lastname: form.lastName, cnic: form.cnic,
          phone: form.phone, email: form.email, address: form.address,
          pasthistory: form.pasthistory, casename: form.caseName,
          statement: form.statement, statementdate: form.statementDate,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to add witness');
      if (editing) {
        setWitnesses(current => current.map(item => item.id === editing.id ? { ...item, ...form } : item));
      } else {
        setWitnesses([{
          ...form,
          id: `${data.id}-${data.caseid}`,
          witnessId: data.id,
          caseid: data.caseid,
        }, ...witnesses]);
      }
      setForm({ firstName: '', lastName: '', cnic: '', phone: '', email: '', address: '', pasthistory: '', caseName: '', statement: '', statementDate: '' });
      setShow(false);
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-4">
      <Card className="shadow mb-4">
        <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
          Witnesses
          <Button variant="primary" onClick={() => { setEditing(null); setError(''); setShow(true); }}>Add Witness</Button>
        </Card.Header>
        <Card.Body>
          {error && <div className="text-danger mb-2">{error}</div>}
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <Table bordered hover>
              <thead className="table-light">
                <tr>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>CNIC</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Past History</th>
                  <th>Case Name</th>
                  <th>Statement</th>
                  <th>Statement Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {witnesses.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center text-muted py-4">
                      No witnesses found.
                    </td>
                  </tr>
                ) : (
                  witnesses.map(w => (
                    <tr key={w.id}>
                      <td>{w.firstName}</td>
                      <td>{w.lastName}</td>
                      <td>{w.cnic}</td>
                      <td>{w.phone}</td>
                      <td>{w.email}</td>
                      <td>{w.address}</td>
                      <td>{w.pasthistory}</td>
                      <td>{w.caseName}</td>
                      <td>{w.statement}</td>
                      <td>{w.statementDate}</td>
                      <td>
                        <Button size="sm" variant="primary" className="me-1" onClick={() => { setEditing(w); setForm({ ...w }); setShow(true); }}>Edit</Button>
                        <Button size="sm" variant="info" className="me-1" onClick={() => setSelected(w)}>View</Button>
                        <Button size="sm" variant="secondary" onClick={() => downloadRecord(`witness-${w.witnessId || w.id}.txt`, w)}>Download</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
      <Modal show={show} onHide={() => { setShow(false); setEditing(null); }} centered>
        <Modal.Header closeButton><Modal.Title>{editing ? 'Edit Witness' : 'Add Witness'}</Modal.Title></Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {[
              ['firstName', 'First Name'], ['lastName', 'Last Name'], ['cnic', 'CNIC'],
              ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'],
              ['pasthistory', 'Past History'], ['caseName', 'Case Name'], ['statement', 'Statement']
            ].map(([name, label]) => (
              <Form.Group className="mb-3" key={name}>
                <Form.Label>{label}</Form.Label>
                <Form.Control name={name} value={form[name]} onChange={handleChange} required={name !== 'pasthistory'} disabled={Boolean(editing) && name === 'caseName'} />
              </Form.Group>
            ))}
            <Form.Group className="mb-3">
              <Form.Label>Statement Date</Form.Label>
              <Form.Control type="date" name="statementDate" value={form.statementDate} onChange={handleChange} required />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Submit'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <RecordDetailsModal title="Witness Details" record={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default Witnesses;
