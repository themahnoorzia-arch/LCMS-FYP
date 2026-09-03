import React from 'react';
import { Card, Table, Badge } from 'react-bootstrap';

const mockCourtrooms = [
  { id: 1, courtroomno: '101', capacity: 50, status: 'Available' },
  { id: 2, courtroomno: '102', capacity: 40, status: 'Occupied' },
  { id: 3, courtroomno: '103', capacity: 60, status: 'Available' },
];

const statusVariant = status => {
  if (status === 'Available') return 'success';
  if (status === 'Occupied') return 'danger';
  return 'secondary';
};

const CourtroomTable = () => (
  <Card className="shadow mb-4">
    <Card.Header as="h5">Courtrooms</Card.Header>
    <Card.Body>
      <Table bordered hover>
        <thead className="table-light">
          <tr>
            <th>Courtroom No</th>
            <th>Capacity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {mockCourtrooms.map(room => (
            <tr key={room.id}>
              <td>{room.courtroomno}</td>
              <td>{room.capacity}</td>
              <td><Badge bg={statusVariant(room.status)}>{room.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card.Body>
  </Card>
);

export default CourtroomTable; 