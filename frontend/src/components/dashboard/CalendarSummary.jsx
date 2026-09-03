import React, { useState, useEffect } from 'react';
import { Card, Row, Col, ListGroup, Badge, Button, Modal, Form } from 'react-bootstrap';
import { Calendar as CalendarIcon, Clock, MapPin, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import moment from 'moment';
import 'bootstrap/dist/css/bootstrap.min.css';
import './CalendarSummary.css';

const EVENT_TYPES = [
  { label: 'Court Date', value: 'Court Date' },
  { label: 'Meeting', value: 'Meeting' },
  { label: 'Deadline', value: 'Deadline' },
];

const CalendarSummary = () => {
  const [currentDate, setCurrentDate] = useState(moment());
  const [selectedDate, setSelectedDate] = useState(moment());
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
useEffect(() => {
  fetch('/api/hearings', {
    credentials: 'include', // Ensures session cookies are sent to Flask
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.hearings) {
        const formattedEvents = data.hearings.map((h) => ({
          id: h.hearingid,
          hearingNumber: h.hearingnumber || h.hearingid,
          title: h.casename || 'Court Hearing',
          date: moment(h.hearingdate),
          time: h.hearingtime || 'TBD',
          type: 'Court Date',
          location: h.venue || h.courtname || 'Venue not assigned',
          court: h.courtname || 'N/A',
          judge: h.judgename || 'N/A',
          lawyers: h.lawyernames || 'N/A',
          client: h.clientname || 'N/A',
          status: h.hearingstatus || h.status || 'scheduled',
          priority: 'high',
        }));
        setEvents(formattedEvents);
      }
    })
    .catch((err) => {
      console.error('Error fetching hearings:', err);
    });
}, []);

  const getDaysInMonth = () => {
    const daysInMonth = currentDate.daysInMonth();
    const firstDayOfMonth = moment(currentDate).startOf('month');
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth.day(); i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(moment(currentDate).date(i));
    }
    
    // Add empty cells to complete the last week
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    
    return days;
  };

  const getEventsForDay = (day) => {
    return events.filter(event => event.date.isSame(day, 'day'));
  };

  const getEventBadgeVariant = (type) => {
    switch (type) {
      case 'Court Date': return 'danger';
      case 'Meeting': return 'primary';
      case 'Deadline': return 'warning';
      default: return 'info';
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(moment(currentDate).subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentDate(moment(currentDate).add(1, 'month'));
  };

  const handleDayClick = (day) => {
    if (day) setSelectedDate(day.clone());
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const isToday = (day) => {
    return day && day.isSame(moment(), 'day');
  };

  const selectedEvents = getEventsForDay(selectedDate);

  return (
    <div className="calendar-container p-2 p-md-3 p-lg-4">
      <Row className="g-3 g-lg-4 justify-content-center align-items-stretch">
        {/* Calendar Card - now wider */}
        <Col xs={12} md={7} lg={8} xl={8} xxl={9}>
          <Card className="shadow-sm border-0 rounded-4 h-100">
            <Card.Body className="p-3 p-md-4">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center gap-3">
                  <Button
                    variant="light"
                    className="rounded-circle p-2"
                    onClick={handlePrevMonth}
                  >
                    <ChevronLeft size={20} />
                  </Button>
                  <h4 className="mb-0 fw-bold">{currentDate.format('MMMM YYYY')}</h4>
                  <Button
                    variant="light"
                    className="rounded-circle p-2"
                    onClick={handleNextMonth}
                  >
                    <ChevronRight size={20} />
                  </Button>
                </div>
              </div>

              <div className="calendar-grid">
                <div className="calendar-header">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="calendar-cell header">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="calendar-body">
                  {getDaysInMonth().map((day, idx) => {
                    const isSelected = day && day.isSame(selectedDate, 'day');
                    const dayEvents = day ? getEventsForDay(day) : [];
                    const hasEvents = dayEvents.length > 0;

                    return (
                      <div
                        key={idx}
                        className={`calendar-cell ${isSelected ? 'selected' : ''} ${isToday(day) ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
                        onClick={() => handleDayClick(day)}
                      >
                        {day && (
                          <>
                            <div className="date-number">{day.date()}</div>
                            {hasEvents && (
                              <div className="events-preview">
                                {dayEvents.slice(0, 2).map(event => (
                                  <div
                                    key={event.id}
                                    className="event-dot"
                                    style={{ backgroundColor: `var(--bs-${getEventBadgeVariant(event.type)})` }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEventClick(event);
                                    }}
                                  />
                                ))}
                                {dayEvents.length > 2 && (
                                  <div className="more-events">+{dayEvents.length - 2}</div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Events Panel - now wider */}
        <Col xs={12} md={5} lg={4} xl={4} xxl={3}>
          <Card className="shadow-sm border-0 rounded-4 h-100">
            <Card.Body className="p-3 p-md-4">
              <h5 className="mb-4 fw-bold">
                {selectedDate.format('dddd, MMMM Do')}
              </h5>
              {selectedEvents.length === 0 ? (
                <div className="text-center text-muted py-5">
                  <CalendarIcon size={48} className="mb-3 opacity-50" />
                  <p className="mb-0">No events scheduled for this day</p>
                </div>
              ) : (
                <ListGroup variant="flush" className="events-list">
                  {selectedEvents.map(event => (
                    <ListGroup.Item
                      key={event.id}
                      className="border-0 mb-3 p-3 rounded-3 shadow-sm"
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <Badge bg={getEventBadgeVariant(event.type)}>{event.type}</Badge>
                        <span className="fw-bold">{event.title}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <Clock size={16} className="text-primary" />
                        <span>{event.time}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <MapPin size={16} className="text-primary" />
                        <span>{event.location}</span>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Event Details Modal */}
      <Modal
        show={showEventModal}
        onHide={() => setShowEventModal(false)}
        centered
        className="event-modal"
      >
        {selectedEvent && (
          <>
            <Modal.Header closeButton className="border-0">
              <Modal.Title>
                <Badge bg={getEventBadgeVariant(selectedEvent.type)} className="mb-2">
                  {selectedEvent.type}
                </Badge>
                <h5 className="mb-0">{selectedEvent.title}</h5>
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="d-flex align-items-center gap-2 mb-3">
                <Clock size={20} className="text-primary" />
                <span>{selectedEvent.time}</span>
              </div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <MapPin size={20} className="text-primary" />
                <span>{selectedEvent.location}</span>
              </div>
              <div className="mb-2"><strong>Hearing Number:</strong> {selectedEvent.hearingNumber}</div>
              <div className="mb-2"><strong>Case:</strong> {selectedEvent.title}</div>
              <div className="mb-2"><strong>Court:</strong> {selectedEvent.court}</div>
              <div className="mb-2"><strong>Judge:</strong> {selectedEvent.judge}</div>
              <div className="mb-2"><strong>Lawyer(s):</strong> {selectedEvent.lawyers}</div>
              <div className="mb-2"><strong>Client:</strong> {selectedEvent.client}</div>
              <div className="mb-2"><strong>Status:</strong> {selectedEvent.status}</div>
            </Modal.Body>
            <Modal.Footer className="border-0">
              <Button variant="secondary" onClick={() => setShowEventModal(false)}>
                Close
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
};

export default CalendarSummary;
