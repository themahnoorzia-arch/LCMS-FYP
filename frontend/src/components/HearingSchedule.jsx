import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// --- Setup for react-big-calendar ---
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});
// --- End Setup ---

function HearingSchedule() {
  const cases = [
    {
      id: 1,
      caseNumber: 'Case #123',
      description: 'Injury claim from car accident.',
      relatedHearings: [{ id: 201, date: '2025-05-15 10:00', location: 'Courtroom 3A' }],
    },
    {
      id: 2,
      caseNumber: 'Case #456',
      description: 'Property dispute.',
      relatedHearings: [{ id: 202, date: '2025-05-20 14:30', location: 'Remote (Zoom)' }],
    },
    {
      id: 3,
      caseNumber: 'Case #789',
      description: 'Contract disagreement.',
      relatedHearings: [], // No hearings
    },
  ];

  // Convert case hearings into calendar events
  const myEventsList = cases.flatMap((caseItem) =>
    caseItem.relatedHearings.map((hearing) => {
      const startDate = new Date(hearing.date);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
      return {
        title: `Hearing: ${caseItem.caseNumber}`,
        start: startDate,
        end: endDate,
        caseNumber: caseItem.caseNumber,
        location: hearing.location,
        description: caseItem.description,
      };
    })
  );

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleNavigate = (newDate) => setCurrentDate(newDate);
  const handleView = (newView) => setCurrentView(newView);
  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
  };

  const formattedStartTime = selectedEvent ? format(selectedEvent.start, 'Pp', { locale: enUS }) : '';
  const formattedEndTime = selectedEvent ? format(selectedEvent.end, 'Pp', { locale: enUS }) : '';

  return (
    <div className="container mt-4">
      <h4>Hearing Schedule</h4>
      <div style={{ height: 500 }}>
        <Calendar
          localizer={localizer}
          events={myEventsList}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          date={currentDate}
          view={currentView}
          onNavigate={handleNavigate}
          onView={handleView}
          onSelectEvent={handleSelectEvent}
        />
      </div>

      {/* Modal to show event details */}
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>{selectedEvent?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEvent && (
            <>
              <p><strong>Case Number:</strong> {selectedEvent.caseNumber}</p>
              <p><strong>Description:</strong> {selectedEvent.description}</p>
              <p><strong>Location:</strong> {selectedEvent.location}</p>
              <p><strong>Time:</strong> {formattedStartTime} - {formattedEndTime}</p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default HearingSchedule;
