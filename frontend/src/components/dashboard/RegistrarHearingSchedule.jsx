import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Modal, Badge } from 'react-bootstrap';

const RegistrarHearingSchedule = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingHearing, setEditingHearing] = useState(null);
  const [hearings, setHearings] = useState([]);
  const [courtRooms, setCourtRooms] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadHearings = async () => {
    try {
      const response = await fetch('/api/hearings', { credentials: 'include' });
      const data = await response.json();
      setHearings(data.hearings || []);
    } catch (error) {
      console.error('Error fetching hearings:', error);
    }
  };

  useEffect(() => {
    loadHearings();

    // Fetch the registrar's own court, then its rooms, so Venue can be
    // picked from the real available courtrooms instead of typed freely.
    const fetchCourtRooms = async () => {
      try {
        const courtRes = await fetch('/api/court', { credentials: 'include' });
        if (!courtRes.ok) return;
        const courtData = await courtRes.json();
        const courtId = courtData?.data?.id;
        if (!courtId) return;
        const roomsRes = await fetch(`/api/courtrooms/${courtId}`, { credentials: 'include' });
        if (!roomsRes.ok) return;
        const roomsData = await roomsRes.json();
        setCourtRooms(roomsData.data || roomsData.rooms || roomsData || []);
      } catch (error) {
        console.error('Error fetching court rooms:', error);
      }
    };
    fetchCourtRooms();
  }, []);

  const [hearingForm, setHearingForm] = useState({
    caseName: '',
    date: '',
    time: '',
    venue: '',
    judge: '',
    status: 'Scheduled'
  });

  // API call to update venue
  const updateVenueApi = async (hearingid, venue) => {
    try {
      const res = await fetch('/api/hearings/addvenue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hearingid, venue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to update venue');
      return data;
    } catch (err) {
      console.error('Error updating venue:', err);
      throw err;
    }
  };

  const updateStatusApi = async (hearingid, status) => {
    const res = await fetch(`/api/hearings/${hearingid}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Failed to update hearing status');
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingHearing || saving) return;
    setSaving(true);
    try {
      const currentStatus = (editingHearing.hearingstatus || editingHearing.status || 'scheduled').toLowerCase();
      if (hearingForm.venue !== (editingHearing.venue || '')) {
        await updateVenueApi(editingHearing.hearingid, hearingForm.venue);
      }
      if (hearingForm.status.toLowerCase() !== currentStatus) {
        await updateStatusApi(editingHearing.hearingid, hearingForm.status);
      }
      // Only close the modal after the server has accepted every change, and
      // re-read from the server instead of assuming what it now holds.
      await loadHearings();
      setShowModal(false);
      setEditingHearing(null);
      setHearingForm({ caseName: '', date: '', time: '', venue: '', judge: '', status: 'Scheduled' });
    } catch (err) {
      alert('Could not save changes: ' + err.message);
      // A venue change may already have gone through before the status one
      // was rejected — resync so the table shows what the server really has.
      await loadHearings();
    } finally {
      setSaving(false);
    }
  };

  const isFinalStatus = (h) =>
    (h?.hearingstatus || h?.status || 'scheduled').toLowerCase() !== 'scheduled';

  const statusLabel = (s) => {
    const map = { scheduled: 'Scheduled', completed: 'Completed', adjourned: 'Adjourned', cancelled: 'Cancelled' };
    return map[(s || '').toLowerCase()] || 'Scheduled';
  };

  const handleEdit = (hearing) => {
    setEditingHearing(hearing);
    setHearingForm({
      caseName: hearing.casename || '',
      date: hearing.hearingdate || '',
      time: hearing.hearingtime || '',
      venue: hearing.venue || '',
      judge: hearing.judgename || '',
      status: statusLabel(hearing.hearingstatus || hearing.status),
    });
    setShowModal(true);
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#22304a' }}>
            <i className="bi bi-calendar-event me-2"></i>Hearing Schedule
          </h2>
          <div className="text-muted">Manage and view court hearing schedules.</div>
        </div>
      </div>

      <Card className="shadow-sm border-0">
        <Card.Body>
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Hearing #</th>
                  <th>Case Name</th>
                  <th>Court</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Venue</th>
                  <th>Judge</th>
                  <th>Lawyer(s)</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hearings.length === 0 ? (
                  <tr><td colSpan={11} className="text-center text-muted py-4">No hearings found.</td></tr>
                ) : hearings.map((hearing) => (
                  <tr key={hearing.hearingid}>
                    <td>{hearing.hearingnumber || hearing.hearingid}</td>
                    <td>{hearing.casename || 'N/A'}</td>
                    <td>{hearing.courtname || 'N/A'}</td>
                    <td>{hearing.hearingdate || 'N/A'}</td>
                    <td>{hearing.hearingtime || 'N/A'}</td>
                    <td>{hearing.venue || 'Not assigned'}</td>
                    <td>{hearing.judgename || 'N/A'}</td>
                    <td>{hearing.lawyernames || 'N/A'}</td>
                    <td>{hearing.clientname || 'N/A'}</td>
                    <td>
                      {(() => {
                        const s = (hearing.hearingstatus || hearing.status || 'scheduled').toLowerCase();
                        const bg = s === 'scheduled' ? 'primary' : s === 'completed' ? 'success' : s === 'adjourned' ? 'warning' : 'secondary';
                        return <Badge bg={bg}>{statusLabel(s)}</Badge>;
                      })()}
                    </td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleEdit(hearing)}
                      >
                        Update
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Update Hearing</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Case Name</Form.Label>
              <Form.Control
                type="text"
                value={hearingForm.caseName}
                readOnly
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                value={hearingForm.date}
                readOnly
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Time</Form.Label>
              <Form.Control
                type="time"
                value={hearingForm.time}
                readOnly
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Venue</Form.Label>
              <Form.Select
                value={hearingForm.venue}
                onChange={(e) => setHearingForm({ ...hearingForm, venue: e.target.value })}
                required
                autoFocus
              >
                <option value="">Select a courtroom</option>
                {courtRooms.map(room => (
                  <option key={room.id} value={`Courtroom ${room.number}`}>
                    Courtroom {room.number} (Capacity: {room.capacity}, {room.status})
                  </option>
                ))}
                {hearingForm.venue && !courtRooms.some(room => `Courtroom ${room.number}` === hearingForm.venue) && (
                  <option value={hearingForm.venue}>{hearingForm.venue} (current)</option>
                )}
              </Form.Select>
              {courtRooms.length === 0 && (
                <Form.Text className="text-muted">
                  No courtrooms found for your court yet — add one on the Court Rooms page first.
                </Form.Text>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Judge</Form.Label>
              <Form.Control
                type="text"
                value={hearingForm.judge}
                readOnly
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={hearingForm.status}
                onChange={(e) => setHearingForm({ ...hearingForm, status: e.target.value })}
                disabled={isFinalStatus(editingHearing)}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Adjourned">Adjourned</option>
                <option value="Cancelled">Cancelled</option>
              </Form.Select>
              {isFinalStatus(editingHearing) && (
                <Form.Text className="text-muted">
                  This hearing's status is final and can't be changed. Schedule a new hearing if needed.
                </Form.Text>
              )}
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default RegistrarHearingSchedule;
