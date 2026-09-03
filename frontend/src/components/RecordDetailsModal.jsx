import React from 'react';
import { Modal, Button, Table } from 'react-bootstrap';

const labelFor = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());

export default function RecordDetailsModal({ title, record, onClose }) {
  return (
    <Modal show={Boolean(record)} onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>{title}</Modal.Title></Modal.Header>
      <Modal.Body>
        <Table bordered size="sm" className="mb-0"><tbody>
          {record && Object.entries(record)
            .filter(([key]) => key !== 'id' && key !== 'witnessId' && key !== 'caseid')
            .map(([key, value]) => (
              <tr key={key}><th style={{ width: '38%' }}>{labelFor(key)}</th><td>{value ?? '—'}</td></tr>
            ))}
        </tbody></Table>
      </Modal.Body>
      <Modal.Footer><Button variant="secondary" onClick={onClose}>Close</Button></Modal.Footer>
    </Modal>
  );
}
