import React, { useState } from 'react';
import { Card, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const CourtRegistrationForm = ({ onSubmit, initialData = null }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialData || {
    name: '',
    address: '',
    courtType: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Court name is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.courtType) newErrors.courtType = 'Court type is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        localStorage.setItem('courtRegistered', 'true');
        navigate('/RegistrarDashboard');
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        submit: error.message || 'Failed to register court'
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <Card className="shadow-lg" style={{ maxWidth: 500, width: '100%', borderRadius: 18, padding: '2.5rem 0', background: 'rgba(255,255,255,0.98)' }}>
        <Card.Body>
          <h2 className="mb-4 text-center fw-bold" style={{ color: '#22304a' }}>Register Your Court</h2>
          <p className="text-muted text-center mb-4">Please provide your court's details to complete registration.</p>
          {errors.submit && (
            <Alert variant="danger" className="mb-4">
              {errors.submit}
            </Alert>
          )}
          <Form onSubmit={handleSubmit}>
            <Row className="g-3">
              <Col xs={12}>
                <Form.Group>
                  <Form.Label>Court Name <span style={{color: 'red'}}>*</span></Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    isInvalid={!!errors.name}
                    placeholder="Enter court name"
                    autoFocus
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label>Address / Location <span style={{color: 'red'}}>*</span></Form.Label>
                  <Form.Control
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    isInvalid={!!errors.address}
                    placeholder="Enter court address"
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.address}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label>Court Type <span style={{color: 'red'}}>*</span></Form.Label>
                  <Form.Select
                    name="courtType"
                    value={formData.courtType}
                    onChange={handleChange}
                    isInvalid={!!errors.courtType}
                  >
                    <option value="">Select court type</option>
                    <option value="Supreme Court">Supreme Court</option>
                    <option value="High Court">High Court</option>
                    <option value="District Court">District Court</option>
                    <option value="Magistrate Court">Magistrate Court</option>
                    <option value="Special Court">Special Court</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.courtType}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex justify-content-end mt-4">
              <Button variant="primary" type="submit" disabled={loading} style={{ minWidth: 160, fontWeight: 600, fontSize: '1.1rem', borderRadius: 8 }}>
                {loading ? 'Registering...' : 'Register Court'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default CourtRegistrationForm;
