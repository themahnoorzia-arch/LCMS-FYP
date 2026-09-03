import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form } from 'react-bootstrap';
import RecordDetailsModal from '../components/RecordDetailsModal';
import { downloadRecord } from '../utils/recordActions';

const Evidence = () => {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    evidenceType: '',
    description: '',
    submissionDate: '',
    caseName: ''
  });
  const [evidence, setEvidence] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);

  // Fetch evidence on component mount
  useEffect(() => {
    fetch('/api/lawyer/evidence', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to fetch evidence');
        }
        return res.json();
      })
      .then((data) => {
        const formatted = data.evidence.map((e) => ({
          id: e.evidence_id || e.id,
          evidenceType: e.evidencetype,
          description: e.description,
          submissionDate: e.submitteddate,
          caseName: e.casename || `Case #${e.case_id || e.caseName}`
        }));
        setEvidence(formatted);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      });
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(editing ? `/api/evidence/${editing.id}` : '/api/evidence', {
        method: editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evidencetype: form.evidenceType,
          description: form.description,
          submissiondate: form.submissionDate,
          casename: form.caseName
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || 'Failed to submit evidence');
      }

      const result = await res.json();
      const newEvidence = {
        id: result.id || Date.now(),
        evidenceType: form.evidenceType,
        description: form.description,
        submissionDate: form.submissionDate,
        caseName: form.caseName
      };

      if (editing) {
        setEvidence(current => current.map(item => item.id === editing.id ? { ...item, ...newEvidence, id: editing.id } : item));
      } else {
        setEvidence([newEvidence, ...evidence]);
      }
      setForm({
        evidenceType: '',
        description: '',
        submissionDate: '',
        caseName: ''
      });
      setShow(false);
      setEditing(null);
    } catch (err) {
      console.error('Submit Error:', err);
      setError(err.message);
    }
  };

  return (
    <div className="container py-4">
      <Card className="shadow mb-4">
        <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
          Evidence
          <Button variant="primary" onClick={() => { setEditing(null); setError(''); setShow(true); }}>Add Evidence</Button>
        </Card.Header>
        <Card.Body>
          {error && <div className="text-danger mb-2">{error}</div>}
          <Table bordered hover>
            <thead className="table-light">
              <tr>
                <th>Evidence Type</th>
                <th>Description</th>
                <th>Submission Date</th>
                <th>Case Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={e.id}>
                  <td>{e.evidenceType}</td>
                  <td>{e.description}</td>
                  <td>{e.submissionDate}</td>
                  <td>{e.caseName}</td>
                  <td>
                    <Button size="sm" variant="primary" className="me-1" onClick={() => {
                      setEditing(e); setForm({ evidenceType: e.evidenceType, description: e.description, submissionDate: e.submissionDate, caseName: e.caseName }); setShow(true);
                    }}>Edit</Button>
                    <Button size="sm" variant="info" className="me-1" onClick={() => setSelected(e)}>View</Button>
                    <Button size="sm" variant="secondary" onClick={() => downloadRecord(`evidence-${e.id}.txt`, e)}>Download</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={show} onHide={() => { setShow(false); setEditing(null); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Edit Evidence' : 'Add Evidence'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Evidence Type</Form.Label>
              <Form.Control name="evidenceType" value={form.evidenceType} onChange={handleChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control name="description" value={form.description} onChange={handleChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Submission Date</Form.Label>
              <Form.Control type="date" name="submissionDate" value={form.submissionDate} onChange={handleChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Case Name</Form.Label>
              <Form.Control name="caseName" value={form.caseName} onChange={handleChange} required disabled={Boolean(editing)} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Submit</Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <RecordDetailsModal title="Evidence Details" record={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default Evidence;
