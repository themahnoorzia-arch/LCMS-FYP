import React, { useState, useEffect } from 'react';
import { Card, Table, Button } from 'react-bootstrap';

const CaseHistory = ({ historyCase }) => {
  const [caseHistory, setCaseHistory] = useState([]);
  const [fallbackWarning, setFallbackWarning] = useState("");

  useEffect(() => {
    const fetchCaseHistory = async () => {
      if (historyCase && historyCase.id) {
        try {
          const res = await fetch(`/api/cases/${historyCase.id}/history`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });

          if (!res.ok) throw new Error('Failed to fetch case history');

          const data = await res.json();

          if (data && Array.isArray(data.history)) {
            setCaseHistory(data.history);
          } else {
            setCaseHistory([]);
            setFallbackWarning("No case history available.");
          }
        } catch (err) {
          console.error('Failed to fetch case history:', err);
          setCaseHistory([]);
          setFallbackWarning("Error fetching case history.");
        }
      }
    };

    fetchCaseHistory();
  }, [historyCase]);  // Dependency on historyCase

  return (
    <div className="container py-4">
      {fallbackWarning && (
        <div className="alert alert-warning text-center">{fallbackWarning}</div>
      )}
      <Card className="shadow mb-4">
        <Card.Header as="h5">Case History</Card.Header>
        <Card.Body>
          <Table bordered hover>
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {caseHistory.length > 0 ? (
                caseHistory.map(h => (
                  <tr key={h.id}>
                    <td>{h.date}</td>
                    <td>{h.event}</td>
                    <td>{h.remarks}</td>
                    <td>
                      <Button size="sm" variant="primary" className="me-1">Edit</Button>
                      <Button size="sm" variant="info" className="me-1">View</Button>
                      <Button size="sm" variant="secondary">Download</Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center">No case history found</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default CaseHistory;
