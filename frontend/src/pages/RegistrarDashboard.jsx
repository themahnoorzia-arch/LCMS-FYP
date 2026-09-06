import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, ListGroup, Nav, Badge, Tab, Toast, Spinner, InputGroup, Table } from 'react-bootstrap';
import { Plus, Building2, Users, Gavel, Briefcase, DollarSign, UserCheck, FileText, Search, Trash2, Edit2, ArrowLeft, User, Eye, Mail, Phone, MapPin, Award, Upload, Edit3, Save, ChevronLeft, ChevronRight, CalendarIcon, Clock } from 'lucide-react';
import 'bootstrap/dist/css/bootstrap.min.css';
import lawImage from '../assets/law.png'
import { useLocation, useNavigate } from 'react-router-dom';
import CalendarSummary from '../components/dashboard/CalendarSummary';
import moment from 'moment';
import '../components/dashboard/CalendarSummary.css';
import RegistrarHearingSchedule from '../components/dashboard/RegistrarHearingSchedule';
import Notifications from '../components/dashboard/Notifications';

const onlyDigits = (value) => (value || '').replace(/\D/g, '');
const isEmailValid = (email) => /\S+@\S+\.\S+/.test(email || '');
const isPhoneValid = (value) => {
  const digits = onlyDigits(value);
  return digits.length === 11 && digits.startsWith('03');
};

const RegistrarDashboard = () => {
  // Courts state
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [courtError, setCourtError] = useState('');

  const [judges, setJudges] = useState([]);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyingCase, setVerifyingCase] = useState(null);
  const [verifyForm, setVerifyForm] = useState({
    casename: '',
    type: '',
    filingdate: '',
    clientname: '',
    lawyername: '',
    judgename: '',
    prosecutorname: ''
  });
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');
  const [judgeOptions, setJudgeOptions] = useState([]);
  const [prosecutorOptions, setProsecutorOptions] = useState([]);


  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  // Court management state
  const [courtRooms, setCourtRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomError, setRoomError] = useState('');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ number: '', name: '', capacity: '', type: '', status: '' });
  const [editingRoom, setEditingRoom] = useState(null);
  const [searchRoom, setSearchRoom] = useState('');

  const [courtJudges, setCourtJudges] = useState([]);
  const [searchJudge, setSearchJudge] = useState('');
  const [showJudgeModal, setShowJudgeModal] = useState(false);
  const [editingJudge, setEditingJudge] = useState(null);
  const [judgeForm, setJudgeForm] = useState({ id: '', assignedCases: [] });
  const [availableJudges, setAvailableJudges] = useState([]);
  const [loadingAvailableJudges, setLoadingAvailableJudges] = useState(false);
  const [assignJudgeId, setAssignJudgeId] = useState('');

  const [courtProsecutors, setCourtProsecutors] = useState([
    { id: 1, name: 'Alex Mason', experience: 5, status: 'Active', assignedCases: ['State v. Smith'] },
    { id: 2, name: 'Sam Fisher', experience: 3, status: 'Active', assignedCases: ['People v. Doe'] },
    { id: 3, name: 'Lara Croft', experience: 7, status: 'Active', assignedCases: [] },
  ]);
  const [searchProsecutor, setSearchProsecutor] = useState('');
  const [courtPayments, setCourtPayments] = useState([
  ]);
  const [searchPayment, setSearchPayment] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    caseName: '',
    caseid: '',
    lawyerid: '',
    lawyerName: '',
    clientName: '',
    caseLawyers: [],
    paymentType: '',
    purpose: '',
    amount: '',
    paymentDate: '',
    status: 'Pending'
  });
  const [loadingPayments, setLoadingPayments] = useState(true);  
  const fetchPayments = async () => {
    try {
      setLoadingPayments(true);
      const response = await fetch('/api/payments', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to fetch payments');

      const data = await response.json();

      const mappedPayments = (data.payments || []).map((p, index) => ({
        id: p.paymentid || index + 1,
        caseName: p.casename || '',
        lawyerName: p.lawyername || '-',
        clientName: p.clientname || '-',
        paymentType: p.paymenttype || 'Court Fee', // default type
        purpose: p.purpose || '',
        amount: p.balance || 0,
        mode: p.mode || '',
        paymentDate: p.paymentdate || '',
        status: p.status || 'Paid'
      }));

      setCourtPayments(mappedPayments);
    } catch (err) {
  console.error('Error fetching payments:', err);
} finally {
      setLoadingPayments(false);
    }
  };

useEffect(() => {
  fetchPayments();
}, []);

  const handleVerifyPayment = async (paymentId, approve) => {
    try {
      const response = await fetch(`/api/payments/${paymentId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approve }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update payment');
      await fetchPayments();
      showToast(approve ? 'Payment verified as Paid.' : 'Payment sent back to the lawyer for re-confirmation.');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };


  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseid: paymentForm.caseid,
          lawyerid: paymentForm.lawyerid || undefined,
          purpose: paymentForm.purpose,
          balance: paymentForm.amount,
          paymenttype: paymentForm.paymentType,
        }),
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create payment');
      }
      await fetchPayments();
      setPaymentForm({ caseName: '', caseid: '', lawyerid: '', lawyerName: '', clientName: '', caseLawyers: [], paymentType: '', purpose: '', amount: '', paymentDate: '', status: 'Pending' });
      setShowPaymentModal(false);
      showToast('Payment request saved successfully! The lawyer will report the payment mode when they pay it.');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };


  
  const [courtCases, setCourtCases] = useState([]);
  const [errorCases, setErrorCases] = useState(null);
  const [loadingCases, setLoadingCases] = useState(true);
  const [error, setError] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);

  const fetchCourtCases = async () => {
    setLoadingCases(true);
    try {
      const response = await fetch('/api/cases', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }
      const data = await response.json();
      setCourtCases(data.cases || []);
      setLoadingCases(false); 
    } catch (err) {
      setError(err.message);
      setLoadingCases(false); 
    }
  };

// Fetch pending join requests for registrar
const fetchJoinRequests = async () => {
  try {
    setJoinRequestsLoading(true);
    const res = await fetch('/api/registrar/join-requests', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to fetch join requests');
    const data = await res.json();
    setJoinRequests(data || []);
  } catch (err) {
    console.error('Error fetching join requests:', err);
    setJoinRequests([]);
  } finally {
    setJoinRequestsLoading(false);
  }
};

useEffect(() => {
  fetchJoinRequests();
}, []);

// Approve a join request
const handleApproveJoinRequest = async (lawyerid, caseid) => {
  try {
    setJoinRequestsLoading(true);
    const res = await fetch(`/api/registrar/join-requests/${lawyerid}/${caseid}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to approve');
    }
    showToast('Join request approved', 'success');
    await fetchJoinRequests();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error approving join request', 'danger');
  } finally {
    setJoinRequestsLoading(false);
  }
};

// Reject a join request
const handleRejectJoinRequest = async (lawyerid, caseid) => {
  if (!window.confirm('Reject this join request?')) return;
  try {
    setJoinRequestsLoading(true);
    const res = await fetch(`/api/registrar/join-requests/${lawyerid}/${caseid}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to reject');
    }
    showToast('Join request rejected', 'success');
    await fetchJoinRequests();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error rejecting join request', 'danger');
  } finally {
    setJoinRequestsLoading(false);
  }
};

  const [searchCase, setSearchCase] = useState('');

  // Loading state
  const [loading, setLoading] = useState(false);
  
  const [confirm, setConfirm] = useState({ show: false, type: '', payload: null });

  // Add state for tab selection
  const [selectedPage, setSelectedPage] = useState('dashboard');

  // Fetch court cases + join requests for CourtRegistrar role — refetch on
  // mount and every time the Cases tab is opened, so changes made
  // elsewhere (judge assignment, verification, etc.) aren't shown stale.
  useEffect(() => {
    if (selectedPage === 'cases' || selectedPage === 'dashboard') {
      fetchCourtCases();
      fetchJoinRequests();
    }
  }, [selectedPage]);

const fetchProsecutors = async () => {
  try {
    const res = await fetch('/api/prosecutors', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch prosecutors');
    return data.prosecutors || [];
  } catch (err) {
    console.error('Failed to fetch prosecutors:', err);
    return [];
  }
};

useEffect(() => {
  if (selectedPage === 'judges') {
    const fetchJudges = async () => {
      try {
        const res = await fetch('/api/judges', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch judges');
        const data = await res.json();
        setJudges(data.judges || []);
      } catch (err) {
        console.error('Error fetching judges:', err);
      }
    };

    fetchJudges();
  }
}, [selectedPage]);

  // Add state for modals and forms for rooms and cases
  const [showRoomViewModal, setShowRoomViewModal] = useState(false);
  const [viewingRoom, setViewingRoom] = useState(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [caseForm, setCaseForm] = useState({
    title: '',
    description: '',
    caseType: '',
    clientName: '',
    lawyerName: '',
    prosecutor: ''
  });
  const [cases, setCases] = useState([
    {
      id: 1,
      title: 'State v. Smith',
      description: 'Criminal case involving theft',
      caseType: 'Criminal',
      filingDate: '2024-01-15',
      status: 'Open',
      decisionDate: '',
      decisionSummary: '',
      verdict: '',
      lawyerName: 'Adeel Khan',
      clientName: 'John Smith',
      judgeName: 'Judge Judy',
    },
    {
      id: 2,
      title: 'People v. Doe',
      description: 'Civil case regarding property dispute',
      caseType: 'Civil',
      filingDate: '2024-02-01',
      status: 'Pending',
      decisionDate: '',
      decisionSummary: '',
      verdict: '',
      lawyerName: 'Sara Malik',
      clientName: 'Jane Doe',
      judgeName: 'Judge Dredd',
    },
    {
      id: 3,
      title: 'Acme Corp v. Beta',
      description: 'Corporate case about contract breach',
      caseType: 'Corporate',
      filingDate: '2024-01-20',
      status: 'Closed',
      decisionDate: '2024-03-15',
      decisionSummary: 'The court found in favor of the plaintiff based on the evidence presented.',
      verdict: 'Plaintiff wins',
      lawyerName: 'Bilal Ahmed',
      clientName: 'Acme Corp',
      judgeName: 'Judge Amy',
    }
  ]);
useEffect(() => {
  setLoadingCourts(true);
  fetch('/api/court', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(async (res) => {
      if (res.status === 404) {
        // Courts are assigned by an Admin as part of approving a registrar
        // (never self-registered), so this shouldn't happen for a properly
        // approved account — surface it clearly rather than silently
        // failing or bouncing to a self-service form that no longer exists.
        setCourtError('No court is assigned to your account yet. Please contact an administrator.');
        setLoadingCourts(false);
        return null;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to fetch court');
      }
      return res.json();
    })
    .then((response) => {
      if (!response) return;
      const court = response.data;
      setSelectedCourt(court);
      setLoadingCourts(false);
    })
    .catch((err) => {
      console.error('Error fetching court:', err.message);
      setCourtError('Could not load court details.');
      setLoadingCourts(false);
    });
}, []);

useEffect(() => {
  if (selectedPage === 'courtRooms' && selectedCourt?.id) {
    setLoadingRooms(true);
    fetch(`/api/courtrooms/${selectedCourt.id}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch courtrooms');
        return res.json();
      })
      .then((response) => {
        setCourtRooms(response.data || []);
        setLoadingRooms(false);
      })
      .catch((err) => {
        console.error('Error fetching courtrooms:', err.message);
        setRoomError('Could not load court rooms.');
        setLoadingRooms(false);
      });
  }
}, [selectedPage, selectedCourt]);


const fetchCourtRooms = (courtId) => {
  setLoadingRooms(true);
  fetch(`/api/courtrooms/${courtId}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to fetch courtrooms');
      return res.json();
    })
    .then((response) => {
      setCourtRooms(response.data || []);
      setLoadingRooms(false);
    })
    .catch((err) => {
      console.error('Error fetching courtrooms:', err.message);
      setRoomError('Could not load court rooms.');
      setLoadingRooms(false);
    });
};

useEffect(() => {
  const fetchRegistrarProfile = async () => {
    try {
      const response = await fetch('/api/registrarprofile', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch registrar profile');
      const result = await response.json();

      if (result.success) {
        const fullName = `${result.data.firstName} ${result.data.lastName}`;
        const profile = {
          name: fullName,
          email: result.data.email,
          phone: result.data.phone,
          court: result.data.court,
          dob: result.data.dob,
          position: result.data.position,
        };
        setProfileData(profile);
        localStorage.setItem('registrarProfile', JSON.stringify(profile));
      } else {
        showToast(result.message || 'Error loading profile', 'danger');
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      showToast(err.message || 'Error loading profile', 'danger');
    }
  };

  fetchRegistrarProfile();
}, []);


  const filteredCases = courtCases.filter(c => {
    if (!searchCase.trim()) return true;
    return (
      (c.title || '').toLowerCase().includes(searchCase.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchCase.toLowerCase()) ||
      (c.caseType || '').toLowerCase().includes(searchCase.toLowerCase())
    );
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState(() => {
    const saved = localStorage.getItem('registrarProfile');
    return saved ? JSON.parse(saved) : { name: '', email: '', phone: '', court: '' };
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Add state for profile image
  const PROFILE_IMAGE_KEY = 'registrarProfileImage';
  const [profileImage, setProfileImage] = useState(() => localStorage.getItem(PROFILE_IMAGE_KEY) || null);
  const fileInputRef = useRef(null);

  // Add these state variables at the top with other state declarations
  const [showFinalDecisionModal, setShowFinalDecisionModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

 const [evidence, setEvidence] = useState([]);
const [searchEvidence, setSearchEvidence] = useState('');
const filteredEvidence = evidence.filter(e =>
  (e.caseName || '').toLowerCase().includes(searchEvidence.toLowerCase()) ||
  (e.evidenceType || '').toLowerCase().includes(searchEvidence.toLowerCase()) ||
  (e.description || '').toLowerCase().includes(searchEvidence.toLowerCase()) ||
  (e.lawyerName || '').toLowerCase().includes(searchEvidence.toLowerCase())
);

const [witnesses, setWitnesses] = useState([]);
const [searchWitness, setSearchWitness] = useState('');
const filteredWitnesses = witnesses.filter(({ witness = {}, cases = [] }) => {
  const query = searchWitness.toLowerCase();
  return `${witness.firstname || ''} ${witness.lastname || ''}`.toLowerCase().includes(query)
    || (witness.phone || '').toLowerCase().includes(query)
    || (witness.email || '').toLowerCase().includes(query)
    || cases.some(caseInfo =>
      (caseInfo.title || '').toLowerCase().includes(query)
      || (caseInfo.statement || '').toLowerCase().includes(query)
      || (caseInfo.lawyerName || '').toLowerCase().includes(query)
    );
});


useEffect(() => {
  if (selectedPage !== 'witnesses') return;
  const fetchWitnesses = async () => {
    try {
      const response = await fetch('/api/witnesses/court', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch witnesses');
      const data = await response.json();
      setWitnesses(data.witnesses || []);
    } catch (error) {
      console.error('Error fetching witnesses:', error);
    }
  };

  fetchWitnesses();
}, [selectedPage]);


useEffect(() => {
  if (selectedPage !== 'evidence') return;
  const fetchEvidence = async () => {
    try {
      const response = await fetch('/api/evidence', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch evidence');
      const data = await response.json();
      setEvidence((data.evidence || []).map(item => ({
        ...item,
        submissionDate: item.submissionDate || item.date || 'N/A',
        lawyerName: item.lawyerName || 'N/A',
        file: item.file || item.filepath || '',
      })));
    } catch (error) {
      console.error('Error fetching evidence:', error);
    }
  };

  fetchEvidence();
}, [selectedPage]);

  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const storedImage = localStorage.getItem(PROFILE_IMAGE_KEY);
    if (storedImage) setProfileImage(storedImage);
  }, []);

  const handleProfileImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  const triggerProfileImageUpload = () => fileInputRef.current.click();

  // Toast helpers
  const showToast = (message, variant = 'success') => {
    setToast({ show: true, message, variant });
    setTimeout(() => setToast({ show: false, message: '', variant: 'success' }), 2500);
  };

  // COURT ROOMS CRUD
  const handleRoomFormChange = (e) => setRoomForm({ ...roomForm, [e.target.name]: e.target.value });
  const handleRoomSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  const isEditing = !!editingRoom;
  const url = isEditing 
    ? `/api/courtrooms/${editingRoom.id}` 
    : '/api/courtrooms';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(roomForm),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || (isEditing ? 'Failed to update room' : 'Failed to add room'));
    }

    showToast(isEditing ? 'Room updated!' : 'Room added!');
    setShowRoomModal(false);
    setEditingRoom(null);
    setRoomForm({
      number: '',
      name: '',
      capacity: '',
      type: '',
      status: 'Available',
    });

    // Optionally refresh room list
    if (selectedCourt?.id) {
      fetchCourtRooms(selectedCourt.id);
    }

  } catch (err) {
    console.error('Room error:', err);
    showToast(err.message || 'Error submitting room', 'danger');
  } finally {
    setLoading(false);
  }
};


  const handleRoomView = (room) => {
  setViewingRoom(room);
  setShowRoomViewModal(true);
};

const handleConfirmDeleteRoom = async () => {
  const room = confirm.payload;
  if (!room || !room.id) {
    console.warn('No room or room.id to delete');
    return;
  }

  try {
    const response = await fetch(`/api/courtrooms/${room.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to delete room');
    }

    // Update UI
    setCourtRooms(prev => prev.filter(r => r.id !== room.id));
    showToast('Room deleted successfully');
  } catch (err) {
    console.error('Error deleting room:', err);
    showToast(err.message, 'danger');
  } finally {
    setConfirm({ show: false, type: '', payload: null });
  }
};


const handleRoomEdit = (room) => {
  setEditingRoom(room);
  setRoomForm({
    number: room.number || '',
    name: room.name || '',
    capacity: room.capacity || '',
    type: room.type || '',
    availability: room.availability,
    id: room.id || null,  // keep id for update
  });
  setShowRoomModal(true);
};

const handleRoomDelete = (room) => {
  setConfirm({ show: true, type: 'deleteRoom', payload: room });
};

const handleRoomAdd = () => {
  setEditingRoom(null);
  setRoomForm({
    number: '',
    name: '',
    capacity: '',
    type: '',
    availability: 'Available',
    id: null,
  });
  setShowRoomModal(true);
};

  // Sidebar navigation (dynamic based on registration)
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <Building2 size={16} /> },
    { key: 'courtRooms', label: 'Court Rooms', icon: <Users size={16} /> },
    { key: 'cases', label: 'Cases', icon: <Briefcase size={16} /> },
    { key: 'hearingSchedule', label: 'Hearing Schedule', icon: <Gavel size={16} /> },
    { key: 'caseHistory', label: 'Case History', icon: <FileText size={16} /> },
    { key: 'evidence', label: 'Evidence', icon: <FileText size={16} /> },
    { key: 'witnesses', label: 'Witnesses', icon: <Users size={16} /> },
    { key: 'payments', label: 'Payments', icon: <DollarSign size={16} /> },
    { key: 'prosecutors', label: 'Prosecutors', icon: <Users size={16} /> },
    { key: 'judges', label: 'Judges', icon: <Users size={16} /> },
  ];

  // Filter helpers
  const filteredRooms = courtRooms.filter(r => r.name.toLowerCase().includes(searchRoom.toLowerCase()));

  // Case handlers
  const handleCaseEdit = (c) => {
    setEditingCase(c);
    setCaseForm({
      ...c,
      caseType: c.caseType || c.casetype || '',
      filingDate: c.filingDate || c.filingdate || '',
      clientName: c.clientName || c.clientname || '',
      lawyerName: c.lawyerName || c.lawyername || '',
      prosecutor: c.prosecutor || c.prosecutorName || '',
      judgeName: c.judgeName === 'N/A' ? '' : (c.judgeName || ''),
    });
    setShowCaseModal(true);
  };
  
  const handleCaseAdd = () => { setEditingCase(null); setCaseForm({ number: '', title: '', parties: '', type: '', status: '' }); setShowCaseModal(true); };
  const handleCaseFormChange = (e) => setCaseForm({ ...caseForm, [e.target.name]: e.target.value });
  const handleCaseSubmit = async (e) => {
    e.preventDefault();
    if (!editingCase) return;

    setLoading(true);
    try {
      const response = await fetch('/api/verifycases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          caseid: editingCase.caseid || editingCase.id,
          judgename: caseForm.judgeName,
          prosecutorname: caseForm.prosecutor || '',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to update case');

      await fetchCourtCases();
      setShowCaseModal(false);
      setEditingCase(null);
      showToast('Case updated successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to update case', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  const loadProsecutors = async () => {
    const prosecutors = await fetchProsecutors();
    setCourtProsecutors(prosecutors); // Assuming you have this state
  };

  loadProsecutors();
}, []);

useEffect(() => {
  if (showVerifyModal || showCaseModal) {
    fetch('/api/judges', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const fetchedJudges = data.judges || [];
        setJudgeOptions(fetchedJudges);
        setCourtJudges(fetchedJudges.map(judge => ({
          ...judge,
          id: judge.judgeid,
          experience: judge.expyears,
          appointmentDate: judge.appointmentdate,
          assignedCases: judge.assigned_cases || [],
        })));
      })
      .catch(() => setJudgeOptions([]));
    fetch('/api/prosecutors', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setProsecutorOptions(data.prosecutors || []))
      .catch(() => setProsecutorOptions([]));
  }
}, [showVerifyModal, showCaseModal]);

const handleVerifyCase = (caseObj) => {
  setVerifyingCase(caseObj);
  setVerifyForm({
    caseid: caseObj.caseid || caseObj.id,
    casename: caseObj.title || '',
    type: caseObj.casetype || caseObj.caseType || '',
    filingdate: caseObj.filingdate || '',
    clientname: caseObj.clientName || caseObj.clientname || '',
    lawyername: caseObj.lawyerName || caseObj.lawyername || '',
    judgename: caseObj.judgeName || '',
    prosecutorname: caseObj.prosecutor || caseObj.prosecutorName || ''
  });
  setVerifyError('');
  setVerifySuccess('');
  setShowVerifyModal(true);
};

const handleVerifyFormChange = (e) => {
  setVerifyForm({ ...verifyForm, [e.target.name]: e.target.value });
};

const handleVerifySubmit = async (e) => {
  e.preventDefault();
  setVerifyLoading(true);
  setVerifyError('');
  setVerifySuccess('');
    try {
    const payload = { ...verifyForm };
    const res = await fetch('/api/verifycases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      setVerifyError(data.error || data.message || 'Verification failed');
    } else {
      setVerifySuccess('Case verified and relationships created.');
      setShowVerifyModal(false);
      showToast('Case verified!', 'success');
      await fetchCourtCases();
    }
  } catch (err) {
    setVerifyError('Verification failed');
  } finally {
    setVerifyLoading(false);
  }
};

  // Profile handlers
  const handleProfileSave = async () => {
    if (profileData.email && !isEmailValid(profileData.email)) {
      showToast('Please enter a valid email address.', 'danger');
      return;
    }
    if (profileData.phone && !isPhoneValid(profileData.phone)) {
      showToast('Phone number must be a valid 11-digit Pakistani mobile number (e.g. 03XXXXXXXXX).', 'danger');
      return;
    }
    const nameParts = (profileData.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');
    try {
      const res = await fetch('/api/registrarprofile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName,
          lastName,
          email: profileData.email,
          phone: profileData.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update profile');
      setIsEditingProfile(false);
      localStorage.setItem('registrarProfile', JSON.stringify(profileData));
      showToast('Profile updated!');
    } catch (err) {
      showToast(err.message || 'Error updating profile', 'danger');
    }
  };
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setProfileData({ ...profileData, phone: onlyDigits(value).slice(0, 11) });
      return;
    }
    setProfileData({ ...profileData, [name]: value });
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  // Helper to get CourtRegistrar info from localStorage (from signup)
  const getCourtRegistrarInfo = () => {
    return { name: '', email: '', phone: '', cnic: '', dob: '' };
  };
  const [courtRegistrarInfo] = useState(getCourtRegistrarInfo());

  // Add this handler function with other handlers
  const handleViewFinalDecision = (case_) => {
    setSelectedCase(case_);
    setShowFinalDecisionModal(true);
  };

  // Add handlers for evidence
  const handleEvidenceAdd = () => {
    setShowEvidenceModal(true);
    setEditingEvidence(null);
    setEvidenceForm({
      caseTitle: '',
      type: '',
      description: '',
      dateAdded: '',
      status: 'Pending'
    });
  };

  const handleEvidenceEdit = (evidence) => {
    setEditingEvidence(evidence);
    setEvidenceForm({ ...evidence });
    setShowEvidenceModal(true);
  };

  const handleEvidenceView = (evidence) => {
    setViewingEvidence(evidence);
    setShowEvidenceViewModal(true);
  };

  const handleEvidenceDelete = (evidence) => {
    setEvidence(evidence.filter(e => e.id !== evidence.id));
    showToast('Evidence deleted!', 'danger');
  };

  // Add handlers for witnesses
  const handleWitnessAdd = () => {
    setShowWitnessModal(true);
    setEditingWitness(null);
    setWitnessForm({
      name: '',
      caseTitle: '',
      contact: '',
      status: 'Pending'
    });
  };

  const handleWitnessEdit = (witness) => {
    setEditingWitness(witness);
    setWitnessForm({ ...witness });
    setShowWitnessModal(true);
  };

  const handleWitnessView = (witness) => {
    setViewingWitness(witness);
    setShowWitnessViewModal(true);
  };

  const handleWitnessDelete = (witness) => {
    setWitnesses(witnesses.filter(w => w.id !== witness.id));
    showToast('Witness deleted!', 'danger');
  };

  // Add state variables for evidence and witness modals
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showEvidenceViewModal, setShowEvidenceViewModal] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState(null);
  const [viewingEvidence, setViewingEvidence] = useState(null);
  const [evidenceForm, setEvidenceForm] = useState({
    caseTitle: '',
    type: '',
    description: '',
    dateAdded: '',
    status: 'Pending'
  });

  const [showWitnessModal, setShowWitnessModal] = useState(false);
  const [showWitnessViewModal, setShowWitnessViewModal] = useState(false);
  const [editingWitness, setEditingWitness] = useState(null);
  const [viewingWitness, setViewingWitness] = useState(null);
  const [witnessForm, setWitnessForm] = useState({
    name: '',
    caseTitle: '',
    contact: '',
    status: 'Pending'
  });

  // Add handlers for evidence form
  const handleEvidenceFormChange = (e) => setEvidenceForm({ ...evidenceForm, [e.target.name]: e.target.value });
  const handleEvidenceSubmit = (e) => {
    e.preventDefault();
    if (editingEvidence) {
      setEvidence(evidence.map(e => e.id === editingEvidence.id ? { ...editingEvidence, ...evidenceForm } : e));
      showToast('Evidence updated!');
    } else {
      setEvidence([...evidence, { ...evidenceForm, id: Date.now() }]);
      showToast('Evidence added!');
    }
    setShowEvidenceModal(false);
    setEditingEvidence(null);
    setEvidenceForm({
      caseTitle: '',
      type: '',
      description: '',
      dateAdded: '',
      status: 'Pending'
    });
  };

  // Add handlers for witness form
  const handleWitnessFormChange = (e) => setWitnessForm({ ...witnessForm, [e.target.name]: e.target.value });
  const handleWitnessSubmit = (e) => {
    e.preventDefault();
    if (editingWitness) {
      setWitnesses(witnesses.map(w => w.id === editingWitness.id ? { ...editingWitness, ...witnessForm } : w));
      showToast('Witness updated!');
    } else {
      setWitnesses([...witnesses, { ...witnessForm, id: Date.now() }]);
      showToast('Witness added!');
    }
    setShowWitnessModal(false);
    setEditingWitness(null);
    setWitnessForm({
      name: '',
      caseTitle: '',
      contact: '',
      status: 'Pending'
    });
  };

  // Add after other state declarations
  const [showProsecutorModal, setShowProsecutorModal] = useState(false);
  const [editingProsecutor, setEditingProsecutor] = useState(null);
  const [prosecutorForm, setProsecutorForm] = useState({
    name: '',
    experience: '',
    status: 'Active',
    assignedCases: []
  });

  // Add after other handlers
  const handleProsecutorFormChange = (e) => {
    setProsecutorForm({ ...prosecutorForm, [e.target.name]: e.target.value });
  };
const handleProsecutorSubmit = async (e) => {
  e.preventDefault();

  const url = editingProsecutor ? '/api/prosecutor' : '/api/prosecutor';
  const method = editingProsecutor ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        id: prosecutorForm.id,
        name: prosecutorForm.name,
        experience: prosecutorForm.experience,
        status: prosecutorForm.status,
        case_names: prosecutorForm.assignedCases,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.message || 'Failed to save prosecutor');

    const refreshedProsecutors = await fetchProsecutors();
    setCourtProsecutors(refreshedProsecutors);
    showToast(editingProsecutor ? 'Prosecutor updated!' : 'Prosecutor added!');
  } catch (err) {
    console.error('Error submitting prosecutor:', err);
    showToast(err.message || 'Submission failed', 'danger');
  } finally {
    setShowProsecutorModal(false);
    setEditingProsecutor(null);
    setProsecutorForm({
      name: '',
      experience: '',
      status: '',
      assignedCases: [],
    });
  }
};

  const handleEditProsecutor = (prosecutor) => {
  setEditingProsecutor(prosecutor);
  setProsecutorForm({
    name: prosecutor.name,
    experience: prosecutor.experience,
    status: prosecutor.status,
    assignedCases: prosecutor.assignedCases || [],
    id: prosecutor.id
  });
  setShowProsecutorModal(true);
};


 const handleDeleteProsecutor = async (prosecutorId) => {
  try {
    const res = await fetch(`/api/prosecutor/${prosecutorId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || result.message || 'Failed to delete prosecutor');

    const refreshedProsecutors = await fetchProsecutors();
    setCourtProsecutors(refreshedProsecutors);
    showToast('Prosecutor deleted!');
  } catch (err) {
    console.error('Error deleting prosecutor:', err);
    showToast('Error deleting prosecutor', 'danger');
  }
};


  // JUDGES
 const handleJudgeSubmit = async (e) => {
  e.preventDefault();
  try {
    let response;

    if (editingJudge) {
      // Managing an existing court judge's case assignments only —
      // their name/position/specialization belong to their own profile.
      response = await fetch(`/api/judges/${judgeForm.id}/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedCases: judgeForm.assignedCases }),
      });
    } else {
      // Assigning an already-approved judge to this court (never creates
      // a new account — judges only exist via normal signup + approval).
      if (!assignJudgeId) throw new Error('Select a judge to assign.');
      response = await fetch(`/api/judges/${assignJudgeId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedCases: judgeForm.assignedCases }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to submit judge');
    }

    await response.json();
    const refreshedResponse = await fetch('/api/judges', { credentials: 'include' });
    const refreshedData = await refreshedResponse.json();
    const refreshedJudges = refreshedData.judges || [];
    setJudges(refreshedJudges);
    setJudgeOptions(refreshedJudges);
    showToast(editingJudge ? 'Case assignments updated!' : 'Judge assigned to your court!');
  } catch (err) {
    console.error('Error submitting judge:', err);
    showToast(err.message || 'Error submitting judge', 'danger');
  } finally {
    setShowJudgeModal(false);
    setEditingJudge(null);
    setAssignJudgeId('');
    setJudgeForm({ id: '', assignedCases: [] });
  }
};

const handleEditJudge = (judge) => {
  setEditingJudge(judge);
  setJudgeForm({
    id: judge.judgeid,
    assignedCases: judge.assigned_cases || judge.assignedCases || [],
  });
  setShowJudgeModal(true);
};

const handleOpenAssignJudge = () => {
  setEditingJudge(null);
  setAssignJudgeId('');
  setJudgeForm({ id: '', assignedCases: [] });
  setLoadingAvailableJudges(true);
  fetch('/api/judges/available', { credentials: 'include' })
    .then(res => res.json())
    .then(data => setAvailableJudges(data.judges || []))
    .catch(() => setAvailableJudges([]))
    .finally(() => setLoadingAvailableJudges(false));
  setShowJudgeModal(true);
};

  const handleDeleteJudge = async (judge) => {
    if (!window.confirm(`Remove ${judge.name} from your court?`)) return;
    try {
      const res = await fetch(`/api/judges/${judge.judgeid}/court`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to remove judge');
      setJudges(prev => prev.filter(j => j.judgeid !== judge.judgeid));
      showToast('Judge removed from your court!');
    } catch (err) {
      showToast(err.message || 'Error removing judge', 'danger');
    }
  };

  // Add state for case history
  const [caseHistory, setCaseHistory] = useState([]);
  const [showCaseTimelineModal, setShowCaseTimelineModal] = useState(false);
  const [timelineCaseId, setTimelineCaseId] = useState(null);
  const [showCaseHistoryModal, setShowCaseHistoryModal] = useState(false);
  const [editingCaseHistory, setEditingCaseHistory] = useState(null);
  const [caseHistoryForm, setCaseHistoryForm] = useState({
    caseName: '',
    judgeName: '',
    clientName: '',
    lawyerName: '',
    remarks: '',
    actionDate: '',
    actionTaken: '',
    status: '',
  });


  const getCaseHistory = async (caseId) => {
  try {
    const response = await fetch(`/api/cases/${caseId}/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Include credentials if session-based auth (e.g., Flask-Login)
        credentials: 'include',
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.history;
  } catch (error) {
    console.error('Failed to fetch case history:', error.message);
    return [];
  }
};

const handleViewCase = async (caseId) => {
  const selectedCase = cases.find((caseItem) => caseItem.id === caseId);
  setViewingCase(selectedCase);
  const history = await getCaseHistory(caseId);  // Await result
  setCaseHistory(history);                       // Save to state
  setShowCaseViewModal(true);
};

  // Case History handlers
  const handleCaseHistoryFormChange = (e) => setCaseHistoryForm({ ...caseHistoryForm, [e.target.name]: e.target.value });
  const handleCaseHistorySubmit = async (e) => {
  e.preventDefault();

  // Prepare entry to save (merge editing entry + form data)
  const entryToSave = editingCaseHistory
    ? { ...editingCaseHistory, ...caseHistoryForm }
    : { ...caseHistoryForm };

  try {
    // Call backend save
    const method = entryToSave.id ? 'PUT' : 'POST';
    const url = entryToSave.id
      ? `/api/cases/history/${entryToSave.id}`      // Update
      :`/api/cases/${caseId}/history`;             // Add new

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actiontaken: entryToSave.actiontaken,
        remarks: entryToSave.remarks,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || 'Failed to save case history');
      return;
    }

    // On success, update local state:
    if (method === 'POST') {
      // If server returns the new entry with ID, add it:
      // (if not returned, you may need to fetch history again)
      // For now, just add local with a temporary ID or refresh
      setCaseHistory((prev) => [{ ...entryToSave, id: result.new_id || Date.now() }, ...prev]);
    } else {
      // For update, replace existing item with updated data
      setCaseHistory((prev) =>
        prev.map((h) => (h.id === entryToSave.id ? { ...h, ...entryToSave } : h))
      );
    }

    // Clear modal and form
    setShowCaseHistoryModal(false);
    setEditingCaseHistory(null);
    setCaseHistoryForm({
      caseName: '',
      judgeName: '',
      clientName: '',
      lawyerName: '',
      remarks: '',
      actionDate: '',
      actionTaken: '',
      status: '',
    });

  } catch (error) {
    alert('Error: ' + error.message);
  }
};

  const handleEditCaseHistory = (entry) => {
    setEditingCaseHistory(entry);
    setCaseHistoryForm({ ...entry });
    setShowCaseHistoryModal(true);
  };
  // const handleDeleteCaseHistory = (id) => {
  //   setCaseHistory(caseHistory.filter(h => h.id !== id));
  // };

  // Assuming `caseId` is available in your component scope

const handleSaveCaseHistory = async (entry) => {
  try {
    const method = entry.id ? 'PUT' : 'POST';
    const url = entry.id
      ? `/api/cases/history/${entry.id}`              // Update existing entry
      : `/api/cases/${caseId}/history`;                // Add new entry

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actiontaken: entry.actiontaken,
        remarks: entry.remarks,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      // Success - update your local state accordingly
      if (method === 'POST') {
        // Optionally refresh case history list or append new entry with server-assigned id
      }
      setShowCaseHistoryModal(false);
      // Refresh the caseHistory state from API or update it locally here
    } else {
      alert(result.message || 'Failed to save case history');
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
};


  useEffect(() => {
    const fetchAllCaseHistory = async () => {
      if (selectedPage !== 'caseHistory') return;

      try {
        const response = await fetch('/api/cases/history', {
          credentials: 'include',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load case history');
        }
        setCaseHistory(data.history || []);
      } catch (error) {
        console.error('Failed to fetch case history:', error);
        setCaseHistory([]);
        showToast(error.message || 'Failed to load case history', 'danger');
      }
    };

    fetchAllCaseHistory();
  }, [selectedPage]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#f4f6fa', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center px-4 py-3 bg-white border-bottom" style={{ minHeight: 64, flex: '0 0 auto' }}>
        <div style={{ fontWeight: 600, fontSize: 22 }}>Court Central</div>
        <div className="d-flex align-items-center gap-4">
          <div style={{ color: '#25304a' }}><Notifications /></div>
          <Button 
            variant="link" 
            className="text-decoration-none d-flex align-items-center gap-2" 
            onClick={() => setShowProfileModal(true)}
            style={{ color: '#25304a' }}
          >
            <User size={28} />
            <span>Profile</span>
          </Button>
          <Button 
            variant="link" 
            className="text-decoration-none d-flex align-items-center gap-2" 
            onClick={handleLogout}
            style={{ color: '#25304a' }}
          >
            <i className="bi bi-box-arrow-right" style={{ fontSize: 24 }}></i>
            <span>Logout</span>
          </Button>
        </div>
      </div>
      {/* Main Content Flex Row */}
      <div style={{ flex: '1 1 0', display: 'flex', width: '100%', height: '100%', minHeight: 0 }}>
          {/* Sidebar */}
        <div style={{
          width: 200,
          background: 'linear-gradient(135deg, #1ec6b6 0%, #22304a 100%)',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0,
          flex: '0 0 200px',
          borderTopRightRadius: 18,
          borderBottomRightRadius: 18,
          boxShadow: '2px 0 16px 0 rgba(34,48,74,0.08)',
        }}>
          <div>
            <div className="d-flex align-items-center gap-2 px-4 py-4" style={{ fontWeight: 700, fontSize: 22 }}>
              <i className="bi bi-bank2" style={{ fontSize: 20, color: '#fff' }}></i>
              <span style={{ color: '#fff', fontSize: 16 }}>Court Central</span>
            </div>
            <Nav className="flex-column gap-1 px-1">
              {navItems.map(item => (
                <Nav.Link
                  key={item.key}
                  className={`d-flex align-items-center gap-1 sidebar-link${selectedPage === item.key ? ' active' : ''}`}
                  onClick={() => setSelectedPage(item.key)}
                  style={{
                    background: selectedPage === item.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: selectedPage === item.key ? '#1ec6b6' : '#fff',
                    fontWeight: selectedPage === item.key ? 600 : 500,
                    borderRadius: 8,
                    marginBottom: 1,
                    padding: '6px 8px',
                    fontSize: 14,
                    transition: 'all 0.18s',
                    boxShadow: selectedPage === item.key ? '0 2px 8px rgba(30,198,182,0.08)' : 'none',
                    borderLeft: selectedPage === item.key ? '3px solid #fff' : '3px solid transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = selectedPage === item.key ? 'rgba(255,255,255,0.12)' : 'transparent'}
                >
                  {React.cloneElement(item.icon, { size: 16 })}
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                </Nav.Link>
              ))}
            </Nav>
          </div>
        </div>
        {/* Main Area */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div className="p-4" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {selectedPage === 'dashboard' && (
              <>
                <div className="mb-4">
                  <Card className="shadow-sm border-0" style={{ borderRadius: 16 }}>
                    <Card.Body>
                      <h1 className="fw-bold mb-1" style={{ color: '#22304a' }}>Welcome, Registrar!</h1>
                      <div className="text-muted" style={{ fontSize: 18 }}>Your central hub for court management tasks.</div>
                    </Card.Body>
                  </Card>
                </div>
                <Row className="g-4">
                  <Col md={8}>
                    <Card className="shadow-sm border-0 mb-4" style={{ borderRadius: 16 }}>
                      <Card.Body>
                        <h3 className="fw-bold mb-3" style={{ color: '#22304a' }}><i className="bi bi-bank2 me-2"></i>Assigned Court Details</h3>
                                
            {loadingCourts ? (
  <div className="text-center py-4">
    <Spinner animation="border" variant="primary" />
    <div>Loading court data...</div>
  </div>
) : courtError ? (
  <div className="alert alert-danger">{courtError}</div>
) : selectedCourt ? (
  <>
    <div className="mb-3">
      <img src={lawImage} alt="court" style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 180 }} />
    </div>
    <h4 className="fw-bold mb-2">{selectedCourt.courtname}</h4>
    <Row className="mb-2">
      <Col md={6}><i className="bi bi-geo-alt me-1"></i> <b>Location:</b> {selectedCourt.location}</Col>
      <Col md={6}><i className="bi bi-building me-1"></i> <b>Type:</b> {selectedCourt.type}</Col>
    </Row>
  </>
) : (
  <p className="text-muted">No court assigned.</p>
)}

                        <div className="text-muted mt-2" style={{ fontSize: 15 }}>
                          This is your primary assigned courthouse. For details on other assignments, please check your profile or contact administration.
                        </div>
                      </Card.Body>
                    </Card>
          </Col>
                  <Col md={4}>
                    <Card className="shadow-sm border-0 mb-4" style={{ borderRadius: 16 }}>
                      <Card.Body>
                        <h3 className="fw-bold mb-3" style={{ color: '#22304a' }}><i className="bi bi-bar-chart me-2"></i>Quick Actions</h3>
                        <div className="mb-3 text-muted">Access key functionalities quickly.</div>
                        <div className="d-grid gap-2">
                          <Button variant="light" className="d-flex align-items-center gap-2 justify-content-start text-start border" style={{ fontWeight: 500 }}>
                            <i className="bi bi-buildings me-2" style={{ color: '#1ec6b6', fontSize: 20 }}></i> Manage Court Rooms
                            <div className="ms-auto small text-muted">View and update court room details.</div>
                                  </Button>
                          <Button variant="light" className="d-flex align-items-center gap-2 justify-content-start text-start border" style={{ fontWeight: 500 }}>
                            <i className="bi bi-file-earmark-text me-2" style={{ color: '#1ec6b6', fontSize: 20 }}></i> Manage Cases
                            <div className="ms-auto small text-muted">Access and manage case information.</div>
                                  </Button>
                                </div>
                              </Card.Body>
                            </Card>
                          </Col>
                      </Row>
              </>
            )}
            {selectedPage === 'courtRooms' && (
              <Card className="shadow-sm border-0" style={{ borderRadius: 16 }}>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h2 className="fw-bold mb-1" style={{ color: '#22304a' }}><i className="bi bi-buildings me-2"></i>Court Room Management</h2>
                      <div className="text-muted mb-2">View, add, or edit court rooms for the assigned courthouse.</div>
                    </div>
                    <Button variant="primary" className="d-flex align-items-center gap-2 px-4 py-2" style={{ fontWeight: 500, fontSize: '1.1rem', borderRadius: 8 }} onClick={handleRoomAdd}>
                      <i className="bi bi-plus-lg"></i> Add New Room
                    </Button>
                  </div>
                  <InputGroup className="mb-3" style={{ maxWidth: 400 }}>
                    <InputGroup.Text><i className="bi bi-search"></i></InputGroup.Text>
                    <Form.Control placeholder="Search rooms by number..." value={searchRoom} onChange={e => setSearchRoom(e.target.value)} />
                  </InputGroup>
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead style={{ background: '#f4f6fa' }}>
                        <tr style={{ color: '#22304a', fontWeight: 600 }}>
                          <th>Room Number</th>
                          <th>Capacity</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
  {loadingRooms ? (
    <tr>
      <td colSpan={4} className="text-center py-4">
        <Spinner animation="border" variant="primary" />
        <div>Loading rooms...</div>
      </td>
    </tr>
  ) : roomError ? (
    <tr>
      <td colSpan={4} className="text-danger text-center py-4">{roomError}</td>
    </tr>
  ) : courtRooms.length === 0 ? (
    <tr>
      <td colSpan={4} className="text-muted text-center py-4">No court rooms found.</td>
    </tr>
  ) : (
    courtRooms.map((room, i) => (
      <tr key={i}>
        <td>{room.number}</td>
        <td>{room.capacity}</td>
        <td>
          <span className={`badge ${room.status === 'Available' ? 'bg-primary' : 'bg-danger'}`}>
  {room.status}
</span>

        </td>
        <td>
          <Button variant="outline-secondary" size="sm" className="me-2 p-1 lh-1" onClick={() => handleRoomView(room)}><Eye size={16} /></Button>
          <Button variant="outline-secondary" size="sm" className="me-2 p-1 lh-1" onClick={() => handleRoomEdit(room)}><Edit2 size={16} /></Button>
        </td>
      </tr>
    ))
  )}
</tbody>

                    </table>
                  </div>
                </Card.Body>
              </Card>
            )}{selectedPage === 'cases' && (
  <Card className="shadow-sm border-0" style={{ borderRadius: 16 }}>
    <Card.Body>
      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#22304a' }}><i className="bi bi-file-earmark-text me-2"></i>Case Management</h2>
          <div className="text-muted mb-2">View and manage cases in your court.</div>
        </div>
      </div>

      {/* Search Box */}
      <InputGroup className="mb-3" style={{ maxWidth: 400 }}>
        <InputGroup.Text><i className="bi bi-search"></i></InputGroup.Text>
        <Form.Control placeholder="Search cases..." value={searchCase} onChange={e => setSearchCase(e.target.value)} />
      </InputGroup>

      {/* Loading and Error Handling */}
      {loadingCases ? (
        <div>Loading...</div>
      ) : errorCases ? (
        <div>Error: {errorCases}</div>
      ) : (
        <div className="table-responsive">
          <Table hover className="align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Case Name</th>
                          <th>Type</th>
                          <th>Filing Date</th>
                          <th>Client</th>
                          <th>Lawyers</th>
                          <th>Prosecutor</th>
                          <th>Judge</th>
                          <th>Status</th>
                          <th>Verify</th>
              </tr>
            </thead>
            <tbody>
              {courtCases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">No cases found.</td>
                </tr>
              ) : (
                courtCases.map((case_) => (
                  <tr key={case_.caseid}>
                    <td>{case_.title}</td>
                            <td>{case_.casetype}</td>
                            <td>{case_.filingdate}</td>
                              <td>{case_.clientname || case_.clientName || 'N/A'}</td>
                              <td>{case_.lawyername || 'N/A'}</td>
                              <td>{case_.casetype === 'Criminal' ? (case_.prosecutor || case_.prosecutorName || 'Not assigned') : 'Not applicable'}</td>
                              <td>{case_.judgeName}</td>
                    <td>
                      <Badge bg={case_.status === 'In Progress' ? 'warning' : case_.status === 'Closed' ? 'success' : 'secondary'} className="px-3 py-1 fs-6">
                        {case_.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex gap-2 align-items-center">
                        {case_.status === 'Pending' ? (
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={() => handleVerifyCase(case_)}
                          >
                          Verify
                          </Button>
                        ) : (
                          <Badge bg="success" className="px-2 py-1">Verified</Badge>
                        )}
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleCaseEdit(case_)}
                        >
                        Edit
                        </Button>

                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      )}
    </Card.Body>
  </Card>
)}

      {/* Pending Lawyer Join Requests */}
      {selectedPage === 'cases' && (
        <Card className="shadow-sm border-0 mt-3" style={{ borderRadius: 16 }}>
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h2 className="fw-bold mb-1" style={{ color: '#22304a' }}><i className="bi bi-people me-2"></i>Pending Lawyer Join Requests</h2>
                <div className="text-muted mb-2">Review and approve or reject lawyer requests to join cases.</div>
              </div>
            </div>
            {joinRequestsLoading ? (
              <div className="text-center py-4">
                <Spinner animation="border" variant="primary" />
                <div>Loading join requests...</div>
              </div>
            ) : joinRequests.length === 0 ? (
              <div className="text-muted text-center py-4">No pending join requests.</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead style={{ background: '#f4f6fa' }}>
                    <tr style={{ color: '#22304a', fontWeight: 600 }}>
                      <th>Case Name</th>
                      <th>Case Number</th>
                      <th>Lawyer Name</th>
                      <th>Side Requested</th>
                      <th>New Client</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {joinRequests.map((r, idx) => (
                      <tr key={`${r.caseid}-${r.lawyerid}-${idx}`}>
                        <td>{r.case_name}</td>
                        <td>{r.casenumber}</td>
                        <td>{r.lawyer_name}</td>
                        <td>{r.side}</td>
                        <td>{r.new_client}</td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button variant="success" size="sm" onClick={() => handleApproveJoinRequest(r.lawyerid, r.caseid)}>Approve</Button>
                            <Button variant="danger" size="sm" onClick={() => handleRejectJoinRequest(r.lawyerid, r.caseid)}>Reject</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

                {selectedPage === 'hearingSchedule' && (
              <Card className="shadow-sm border-0" style={{ borderRadius: 16 }}>
                <Card.Body style={{ padding: 0 }}>
                  <RegistrarHearingSchedule />
                </Card.Body>
              </Card>
            )}

            
            {selectedPage === 'evidence' && (
              <Card className="mb-4">
                <Card.Header>
                  <h5 className="mb-0">Evidence</h5>
                  <p className="text-muted mb-0">View evidence submitted by lawyers/clients</p>
                </Card.Header>
                <Card.Body>
                  <InputGroup className="mb-3">
                    <InputGroup.Text>
                      <Search size={18} />
                    </InputGroup.Text>
                    <Form.Control
                      placeholder="Search by case, type, description, or lawyer..."
                      value={searchEvidence}
                      onChange={(e) => setSearchEvidence(e.target.value)}
                    />
                  </InputGroup>
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Evidence Type</th>
                          <th>Description</th>
                          <th>Submission Date</th>
                          <th>Case Name</th>
                          <th>Lawyer Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEvidence.length === 0 ? (
                          <tr><td colSpan={5} className="text-center text-muted py-4">No evidence found.</td></tr>
                        ) : filteredEvidence.map(e => (
                          <tr key={e.id}>
                            <td>{e.evidenceType}</td>
                            <td>{e.description}</td>
                            <td>{e.submissionDate || 'N/A'}</td>
                            <td>{e.caseName}</td>
                            <td>{e.lawyerName || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card.Body>
              </Card>
            )}
            {selectedPage === 'witnesses' && (
  <Card className="mb-4">
    <Card.Header>
      <h5 className="mb-0">Witnesses</h5>
      <p className="text-muted mb-0">View witnesses submitted by lawyers/clients</p>
    </Card.Header>
    <Card.Body>
      <InputGroup className="mb-3">
        <InputGroup.Text>
          <Search size={18} />
        </InputGroup.Text>
        <Form.Control
          placeholder="Search by name, case, contact, or lawyer..."
          value={searchWitness}
          onChange={(e) => setSearchWitness(e.target.value)}
        />
      </InputGroup>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Name</th>
              <th>Case Name</th>
              <th>Contact</th>
              <th>Statement</th>
              <th>Statement Date</th>
              <th>Lawyer Name</th>
            </tr>
          </thead>
          <tbody>
            {filteredWitnesses.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted py-4">No witnesses found.</td></tr>
            ) : filteredWitnesses.flatMap(({ witness, cases }) =>
              cases.map(caseInfo => (
                <tr key={`${witness.id}-${caseInfo.caseid}`}>
                  <td>{`${witness.firstname || ''} ${witness.lastname || ''}`.trim()}</td>
                  <td>{caseInfo.title || 'N/A'}</td>
                  <td>{witness.phone || witness.email || 'N/A'}</td>
                  <td>{caseInfo.statement || 'N/A'}</td>
                  <td>{caseInfo.statementdate || 'N/A'}</td>
                  <td>{caseInfo.lawyerName || 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card.Body>
  </Card>
)}
            {selectedPage === 'payments' && (
      <Card className="shadow-sm border-0" style={{ borderRadius: 16 }}>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h2 className="fw-bold mb-1" style={{ color: '#22304a' }}>
                <i className="bi bi-credit-card me-2"></i>Payment Management
              </h2>
              <div className="text-muted mb-2">View and manage court payments from lawyers and clients.</div>
            </div>
            <Button
              variant="primary"
              className="d-flex align-items-center gap-2"
              onClick={() => {
                setEditingPayment(null);
                setPaymentForm({
                  caseName: '',
                  caseid: '',
                  lawyerid: '',
                  lawyerName: '',
                  clientName: '',
                  caseLawyers: [],
                  paymentType: '',
                  purpose: '',
                  amount: '',
                  paymentDate: '',
                  status: 'Pending',
                });
                setShowPaymentModal(true);
              }}
            >
              <Plus size={20} /> Add Payment
            </Button>
          </div>
          <InputGroup className="mb-3" style={{ maxWidth: 400 }}>
            <InputGroup.Text><i className="bi bi-search"></i></InputGroup.Text>
            <Form.Control
              placeholder="Search payments by case, lawyer, client, or status..."
              value={searchPayment}
              onChange={(e) => setSearchPayment(e.target.value)}
            />
          </InputGroup>

          {/* Displaying Loading Spinner if Data is Being Loaded */}
          {loadingPayments ? (
            <div>Loading payments...</div>
          ) : error ? (
            <div>{error}</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead style={{ background: '#f4f6fa' }}>
                  <tr style={{ color: '#22304a', fontWeight: 600 }}>
                    <th>Case Name</th>
                    <th>Lawyer</th>
                    <th>Client</th>
                    <th>Payment Type</th>
                    <th>Purpose</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Payment Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
               <tbody>
  {(() => {
    const filteredPayments = courtPayments.filter(
      (p) =>
        (p.caseName?.toLowerCase() || '').includes(searchPayment.toLowerCase()) ||
        (p.lawyerName?.toLowerCase() || '').includes(searchPayment.toLowerCase()) ||
        (p.clientName?.toLowerCase() || '').includes(searchPayment.toLowerCase()) ||
        (p.status?.toLowerCase() || '').includes(searchPayment.toLowerCase())
    );
    if (filteredPayments.length === 0) {
      return <tr><td colSpan={10} className="text-center text-muted py-4">No payments found.</td></tr>;
    }
    return filteredPayments.map((payment) => (
      <tr key={payment.id}>
        <td>{payment.caseName}</td>
        <td>{payment.lawyerName || 'N/A'}</td>  {/* Assuming you handle lawyerName properly */}
        <td>{payment.clientName || 'N/A'}</td>  {/* Assuming you handle clientName properly */}
        <td>{payment.paymentType}</td>
        <td>{payment.purpose}</td>
        <td>${payment.amount}</td>
        <td>{payment.mode}</td>
        <td>{payment.paymentDate}</td>
        <td>
          <Badge bg={
            payment.status === 'Paid' ? 'success'
            : payment.status === 'Pending Verification' ? 'info'
            : 'warning'
          }>
            {payment.status}
          </Badge>
        </td>
        <td>
          {payment.status === 'Pending Verification' && (
            <div className="d-flex gap-2">
              <Button size="sm" variant="success" onClick={() => handleVerifyPayment(payment.id, true)}>Verify</Button>
              <Button size="sm" variant="outline-danger" onClick={() => handleVerifyPayment(payment.id, false)}>Reject</Button>
            </div>
          )}
        </td>
      </tr>
    ));
  })()}
</tbody>

              </table>
            </div>
          )}
        </Card.Body>
      </Card>
            )}
            {selectedPage === 'prosecutors' && (
              <Card className="shadow-sm border-0" style={{ borderRadius: 16 }}>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h2 className="fw-bold mb-1" style={{ color: '#22304a' }}><i className="bi bi-person-badge me-2"></i>Prosecutor Management</h2>
                      <div className="text-muted mb-2">Manage court prosecutors and their case assignments.</div>
                            </div>
                    <Button variant="primary" className="d-flex align-items-center gap-2" onClick={() => {
                      setEditingProsecutor(null);
                      setProsecutorForm({ name: '', experience: '', status: 'Active', assignedCases: [] });
                      setShowProsecutorModal(true);
                    }}>
                      <Plus size={20} /> Add Prosecutor
                    </Button>
                  </div>
                  <InputGroup className="mb-3" style={{ maxWidth: 400 }}>
                    <InputGroup.Text><i className="bi bi-search"></i></InputGroup.Text>
                    <Form.Control 
                      placeholder="Search prosecutors..." 
                      value={searchProsecutor} 
                      onChange={e => setSearchProsecutor(e.target.value)} 
                    />
                  </InputGroup>
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead style={{ background: '#f4f6fa' }}>
                        <tr style={{ color: '#22304a', fontWeight: 600 }}>
                          <th>Name</th>
                          <th>Experience</th>
                          <th>Status</th>
                          <th>Assigned Criminal Cases</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filteredProsecutors = courtProsecutors
                            .filter(p => p.name.toLowerCase().includes(searchProsecutor.toLowerCase()));
                          if (filteredProsecutors.length === 0) {
                            return <tr><td colSpan={5} className="text-center text-muted py-4">No prosecutors found.</td></tr>;
                          }
                          return filteredProsecutors.map((prosecutor) => (
                            <tr key={prosecutor.id}>
                              <td>{prosecutor.name}</td>
                              <td>{prosecutor.experience} years</td>
                              <td>
                                <Badge bg={prosecutor.status === 'Active' ? 'success' : 'warning'}>
                                  {prosecutor.status}
                                </Badge>
                              </td>
                              <td>
                                {prosecutor.assignedCases.length > 0 ? (
                                  <ul className="list-unstyled mb-0">
                                    {prosecutor.assignedCases.map((caseName, idx) => (
                                      <li key={idx}>{caseName}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="text-muted">No cases assigned</span>
                                )}
                              </td>
                              <td>
                                <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEditProsecutor(prosecutor)}>
                                  Edit
                                </Button>
                                <Button variant="outline-danger" size="sm" onClick={() => handleDeleteProsecutor(prosecutor.id)}>
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </Card.Body>
              </Card>
            )}
            {selectedPage === 'judges' && (
  <Card className="shadow-sm border-0" style={{ borderRadius: 16 }}>
    <Card.Body>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#22304a' }}>
            <i className="bi bi-person-badge me-2"></i>Judge Management
          </h2>
          <div className="text-muted mb-2">Assign approved judges to your court and manage their case assignments.</div>
        </div>
        <Button variant="primary" className="d-flex align-items-center gap-2" onClick={handleOpenAssignJudge}>
          <Plus size={20} /> Assign Judge
        </Button>
      </div>
      <InputGroup className="mb-3" style={{ maxWidth: 400 }}>
        <InputGroup.Text><i className="bi bi-search"></i></InputGroup.Text>
        <Form.Control
          placeholder="Search judges..."
          value={searchJudge}
          onChange={e => setSearchJudge(e.target.value)}
        />
      </InputGroup>
      <div className="table-responsive">
        <table className="table align-middle mb-0">
          <thead style={{ background: '#f4f6fa' }}>
            <tr style={{ color: '#22304a', fontWeight: 600 }}>
              <th>Name</th>
              <th>Position</th>
              <th>Experience (years)</th>
              <th>Appointment Date</th>
              <th>Specialization</th>
              <th>Assigned Cases</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const filteredJudges = judges
                .filter(j => j.name?.toLowerCase().includes(searchJudge.toLowerCase()));
              if (filteredJudges.length === 0) {
                return <tr><td colSpan={7} className="text-center text-muted py-4">No judges found.</td></tr>;
              }
              return filteredJudges.map((judge) => (
                <tr key={judge.judgeid}>
                  <td>{judge.name}</td>
                  <td>{judge.position}</td>
                  <td>{judge.expyears}</td>
                  <td>{judge.appointmentdate}</td>
                  <td>{judge.specialization}</td>
                  <td>
                    {judge.assigned_cases?.length > 0 ? (
                      <ul className="list-unstyled mb-0">
                        {judge.assigned_cases.map((caseName, idx) => (
                          <li key={idx}>{caseName}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">No cases assigned</span>
                    )}
                  </td>
                  <td>
                    <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEditJudge(judge)}>
                      Manage Cases
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={() => handleDeleteJudge(judge)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </Card.Body>
  </Card>
)}


            {selectedPage === 'caseHistory' && (
              <>
                <Card className="shadow-sm border-0" style={{ borderRadius: 16 }}>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <h2 className="fw-bold mb-1" style={{ color: '#22304a' }}><i className="bi bi-clock-history me-2"></i>Case History</h2>
                        <div className="text-muted mb-2">View the recorded activity timeline for cases in the court.</div>
                      </div>
                      {/* <Button variant="primary" onClick={() => { setEditingCaseHistory(null); setCaseHistoryForm({ caseName: '', judgeName: '', clientName: '', lawyerName: '', remarks: '', actionDate: '', actionTaken: '', status: '' }); setShowCaseHistoryModal(true); }}>
                        Add Entry
                      </Button> */}
                    </div>
                    <div className="table-responsive">
                      <table className="table align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Case Name</th>
                            <th>Judge Name</th>
                            <th>Client Name</th>
                            <th>Lawyer Name</th>
                            <th>Status</th>
                            <th>Last Activity</th>
                            <th>Timeline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Group the flat event list into one row per case
                            // — a court with many cases would otherwise show
                            // every single event mixed together in one table.
                            const byCaseId = new Map();
                            for (const entry of caseHistory) {
                              const key = entry.caseid ?? entry.caseName;
                              if (!byCaseId.has(key)) byCaseId.set(key, []);
                              byCaseId.get(key).push(entry);
                            }
                            const cases = Array.from(byCaseId.entries()).map(([caseid, entries]) => ({
                              caseid,
                              caseName: entries[0].caseName,
                              judgeName: entries[0].judgeName,
                              clientName: entries[0].clientName,
                              lawyerName: entries[0].lawyerName,
                              status: entries[0].status,
                              lastActivity: entries.reduce((max, e) => (e.actionDate && e.actionDate > max ? e.actionDate : max), entries[0].actionDate || ''),
                            }));
                            if (cases.length === 0) {
                              return <tr><td colSpan={7} className="text-center text-muted py-4">No case history entries found.</td></tr>;
                            }
                            return cases.map(c => (
                              <tr key={c.caseid}>
                                <td>{c.caseName}</td>
                                <td>{c.judgeName}</td>
                                <td>{c.clientName}</td>
                                <td>{c.lawyerName}</td>
                                <td>{c.status}</td>
                                <td>{c.lastActivity || 'N/A'}</td>
                                <td>
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() => { setTimelineCaseId(c.caseid); setShowCaseTimelineModal(true); }}
                                  >
                                    View Timeline
                                  </Button>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </Card.Body>
                </Card>
                <Modal show={showCaseHistoryModal} onHide={() => { setShowCaseHistoryModal(false); setEditingCaseHistory(null); }} centered>
                  <Modal.Header closeButton>
                    <Modal.Title>{editingCaseHistory ? 'Edit Case History Entry' : 'Add Case History Entry'}</Modal.Title>
                  </Modal.Header>
                  <Form onSubmit={handleCaseHistorySubmit}>
                    <Modal.Body>
                      <Form.Group className="mb-3">
                        <Form.Label>Case Name</Form.Label>
                        <Form.Control type="text" name="caseName" value={caseHistoryForm.caseName} onChange={handleCaseHistoryFormChange} required />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Judge Name</Form.Label>
                        <Form.Control type="text" name="judgeName" value={caseHistoryForm.judgeName} onChange={handleCaseHistoryFormChange} required />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Client Name</Form.Label>
                        <Form.Control type="text" name="clientName" value={caseHistoryForm.clientName} onChange={handleCaseHistoryFormChange} />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Lawyer Name</Form.Label>
                        <Form.Control type="text" name="lawyerName" value={caseHistoryForm.lawyerName} onChange={handleCaseHistoryFormChange} />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Remarks</Form.Label>
                        <Form.Control as="textarea" name="remarks" value={caseHistoryForm.remarks} onChange={handleCaseHistoryFormChange} />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Action Date</Form.Label>
                        <Form.Control type="date" name="actionDate" value={caseHistoryForm.actionDate} onChange={handleCaseHistoryFormChange} required />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Action Taken</Form.Label>
                        <Form.Control type="text" name="actionTaken" value={caseHistoryForm.actionTaken} onChange={handleCaseHistoryFormChange} required />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>Status</Form.Label>
                        <Form.Select name="status" value={caseHistoryForm.status} onChange={handleCaseHistoryFormChange} required>
                          <option value="">Select status</option>
                          <option value="Pending">Pending</option>
                          <option value="Completed">Completed</option>
                          <option value="Adjourned">Adjourned</option>
                          <option value="Cancelled">Cancelled</option>
                        </Form.Select>
                      </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" onClick={() => { setShowCaseHistoryModal(false); setEditingCaseHistory(null); }}>Cancel</Button>
                      <Button variant="primary" type="submit">{editingCaseHistory ? 'Save Changes' : 'Add Entry'}</Button>
                    </Modal.Footer>
                  </Form>
                </Modal>

                {/* Case Timeline Modal */}
                <Modal show={showCaseTimelineModal} onHide={() => setShowCaseTimelineModal(false)} centered size="lg">
                  <Modal.Header closeButton>
                    <Modal.Title>
                      {caseHistory.find(e => (e.caseid ?? e.caseName) === timelineCaseId)?.caseName || 'Case'} — Full Timeline
                    </Modal.Title>
                  </Modal.Header>
                  <Modal.Body style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                    {(() => {
                      const events = caseHistory
                        .filter(e => (e.caseid ?? e.caseName) === timelineCaseId)
                        .slice()
                        .sort((a, b) => (a.actionDate || '').localeCompare(b.actionDate || ''));
                      if (events.length === 0) {
                        return <div className="text-center text-muted py-4">No timeline entries found.</div>;
                      }
                      return (
                        <ListGroup variant="flush">
                          {events.map((e, idx) => (
                            <ListGroup.Item key={idx} className="border-0 mb-3 p-3 rounded-3 shadow-sm">
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <Badge bg="light" text="dark" className="border">{e.actionDate || 'N/A'}</Badge>
                                <Badge bg={e.status === 'Closed' ? 'success' : e.status === 'Pending' ? 'secondary' : 'primary'}>{e.status}</Badge>
                              </div>
                              <div className="fw-bold">{e.actionTaken}</div>
                              {e.remarks && <div className="text-muted small mt-1">{e.remarks}</div>}
                            </ListGroup.Item>
                          ))}
                        </ListGroup>
                      );
                    })()}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCaseTimelineModal(false)}>Close</Button>
                  </Modal.Footer>
                </Modal>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toasts */}
      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        bg={toast.variant}
        delay={2500}
        autohide
        style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}
      >
        <Toast.Body className="text-white">{toast.message}</Toast.Body>
      </Toast>

   <Modal show={confirm.show} onHide={() => setConfirm({ show: false, type: '', payload: null })} centered>
  <Modal.Header closeButton>
    <Modal.Title>Confirm Delete</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    {confirm.type === 'deleteRoom' && (
      <span>Are you sure you want to delete courtroom <b>#{confirm.payload?.number}</b>?</span>
    )}
    {confirm.type === 'deletePayment' && (
      <span>Are you sure you want to delete the payment record for <b>{confirm.payload?.caseName}</b>?</span>
    )}
    {/* Add more types if needed */}
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setConfirm({ show: false, type: '', payload: null })}>
      Cancel
    </Button>
    <Button
      variant="danger"
      onClick={() => {
        if (confirm.type === 'deleteRoom') {
          handleConfirmDeleteRoom();
        } else if (confirm.type === 'deletePayment') {
          // Call handleConfirmDeletePayment() if you implement that
        }
      }}
    >
      Delete
    </Button>
  </Modal.Footer>
</Modal>




      {/* Add/Edit Room Modal (full form) */}
      <Modal show={showRoomModal} onHide={() => { setShowRoomModal(false); setEditingRoom(null); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingRoom ? 'Edit Court Room' : 'Add Court Room'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleRoomSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Room Number</Form.Label>
              <Form.Control type="text" name="number" value={roomForm.number} onChange={handleRoomFormChange} required autoFocus />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Capacity</Form.Label>
              <Form.Control type="number" name="capacity" value={roomForm.capacity} onChange={handleRoomFormChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select name="status" value={roomForm.status} onChange={handleRoomFormChange} required>
                <option value="">Select status</option>
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Reserved">Reserved</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowRoomModal(false); setEditingRoom(null); }}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>{loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}{editingRoom ? 'Save Changes' : 'Add Room'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Room View Modal */}
      <Modal show={showRoomViewModal} onHide={() => setShowRoomViewModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Room Details</Modal.Title></Modal.Header>
        <Modal.Body>
          {viewingRoom && <div><b>Name/Number:</b> {viewingRoom.name}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRoomViewModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Case Add/Edit Modal */}
      <Modal show={showCaseModal} onHide={() => { setShowCaseModal(false); setEditingCase(null); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Update Case Assignment</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCaseSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Case Name</Form.Label>
              <Form.Control
                type="text"
                value={caseForm.title}
                readOnly
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              <Form.Select
                value={caseForm.caseType}
                readOnly
                disabled
              >
                <option value="">Select type</option>
                <option value="Criminal">Criminal</option>
                <option value="Civil">Civil</option>
                <option value="Family">Family</option>
                <option value="Corporate">Corporate</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Filing Date</Form.Label>
              <Form.Control
                type="date"
                value={caseForm.filingDate}
                readOnly
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Client Name</Form.Label>
              <Form.Control
                type="text"
                value={caseForm.clientName}
                readOnly
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Lawyer Name</Form.Label>
              <Form.Control
                type="text"
                value={caseForm.lawyerName}
                readOnly
                disabled
              />
            </Form.Group>
            {caseForm.caseType === 'Criminal' && (
              <Form.Group className="mb-3">
                <Form.Label>Prosecutor</Form.Label>
                <Form.Select
                  value={caseForm.prosecutor}
                  onChange={e => setCaseForm({ ...caseForm, prosecutor: e.target.value })}
                  required
                >
                  <option value="">Select prosecutor</option>
                  {courtProsecutors.filter(p => p.status === 'Active').map(prosecutor => (
                    <option key={prosecutor.id} value={prosecutor.name}>
                      {prosecutor.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Judge</Form.Label>
              <Form.Select
                value={caseForm.judgeName}
                onChange={e => setCaseForm({ ...caseForm, judgeName: e.target.value })}
                required
              >
                <option value="">Select judge</option>
                {judgeOptions.map(judge => (
                  <option key={judge.judgeid} value={judge.name}>{judge.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowCaseModal(false); setEditingCase(null); }}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>{loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}Save Changes</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Profile Modal */}
      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Registrar Profile</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-4">
            {/* Profile Header - Left Panel */}
            <Col xs={12} md={4}>
              <Card className="shadow-sm h-100">
                <Card.Body className="text-center p-4">
                    <div className="position-relative d-inline-block mb-3">
                    <img
                      src={profileImage || `https://picsum.photos/seed/${profileData.name || 'registrar'}/150/150`}
                      alt="Registrar Avatar"
                      className="rounded-circle border-4 border-primary shadow-sm"
                      width={150}
                      height={150}
                      style={{ objectFit: 'cover' }}
                    />
                    {isEditingProfile && (
                      <Button
                        variant="light"
                        size="sm"
                        className="position-absolute bottom-0 end-0 rounded-circle border shadow-sm"
                        style={{ width: '32px', height: '32px', lineHeight: '1', padding: '0.3rem' }}
                        onClick={triggerProfileImageUpload}
                        title="Upload new picture"
                      >
                        <Upload size={16} />
                      </Button>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleProfileImageUpload}
                      accept="image/*"
                      className="d-none"
                    />
                  </div>
                  <h4 className="mb-1 fw-semibold text-primary">{profileData.name}</h4>
                  <div className="d-grid gap-2 d-sm-flex justify-content-sm-center mb-3">
                    <Button variant="outline-primary" size="sm" href={`mailto:${profileData.email}`}>
                      <Mail size={16} className="me-1" /> Email
                    </Button>
                    <Button variant="outline-primary" size="sm" href={`tel:${profileData.phone}`}>
                      <Phone size={16} className="me-1" /> Call
                    </Button>
                  </div>
                  <hr />
                  <div className="text-start">
                    <p className="mb-2 d-flex align-items-start">
                      <MapPin size={18} className="me-2 text-primary shrink-0 mt-1" />
                      <span>{profileData.court || 'N/A'}</span>
                    </p>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            {/* Profile Details - Right Panel */}
            <Col xs={12} md={8}>
              <Card className="shadow-sm mb-4">
                <Card.Header className="bg-light">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 text-primary">Registrar Information</h5>
                    <div>
                      {isEditingProfile ? (
                        <>
                          <Button variant="success" size="sm" onClick={handleProfileSave} className="me-2">
                            <Save size={16} className="me-1" /> Save
                          </Button>
                          <Button variant="outline-secondary" size="sm" onClick={() => setIsEditingProfile(false)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline-primary" size="sm" onClick={() => setIsEditingProfile(true)}>
                          <Edit3 size={16} className="me-1" /> Edit Profile
                        </Button>
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-4">
                  <Form>
                    <Row className="g-3">
                      <Col md={12}>
                        <Form.Group>
                          <Form.Label>Name</Form.Label>
                          <Form.Control
                            type="text"
                            name="name"
                            value={profileData.name}
                            disabled={!isEditingProfile}
                            onChange={handleProfileChange}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label>Email</Form.Label>
                          <Form.Control
                            type="email"
                            name="email"
                            value={profileData.email}
                            disabled={!isEditingProfile}
                            onChange={handleProfileChange}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label>Phone</Form.Label>
                          <Form.Control
                            type="text"
                            name="phone"
                            value={profileData.phone}
                            disabled={!isEditingProfile}
                            maxLength={11}
                            onChange={handleProfileChange}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={12}>
                        <Form.Group>
                          <Form.Label>Court</Form.Label>
                          <Form.Control
                            type="text"
                            name="court"
                            value={profileData.court}
                            disabled={!isEditingProfile}
                            onChange={handleProfileChange}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Modal.Body>
      </Modal>

      {/* Final Decision Modal */}
      <Modal show={showFinalDecisionModal} onHide={() => setShowFinalDecisionModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Final Decision</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedCase && (
            <>
              <div><strong>Decision Date:</strong> {selectedCase.decisionDate || '-'}</div>
              <div><strong>Summary:</strong> {selectedCase.decisionSummary || '-'}</div>
              <div><strong>Verdict:</strong> {selectedCase.verdict || '-'}</div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFinalDecisionModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Evidence Add/Edit Modal */}
      <Modal show={showEvidenceModal} onHide={() => { setShowEvidenceModal(false); setEditingEvidence(null); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingEvidence ? 'Edit Evidence' : 'Add Evidence'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEvidenceSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Case</Form.Label>
              <Form.Select name="caseTitle" value={evidenceForm.caseTitle} onChange={handleEvidenceFormChange} required>
                <option value="">Select case</option>
                {cases.map(c => (
                  <option key={c.id} value={c.title}>{c.title}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              <Form.Select name="type" value={evidenceForm.type} onChange={handleEvidenceFormChange} required>
                <option value="">Select type</option>
                <option value="Document">Document</option>
                <option value="Physical">Physical</option>
                <option value="Digital">Digital</option>
                <option value="Testimony">Testimony</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control type="text" name="description" value={evidenceForm.description} onChange={handleEvidenceFormChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Date Added</Form.Label>
              <Form.Control type="date" name="dateAdded" value={evidenceForm.dateAdded} onChange={handleEvidenceFormChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select name="status" value={evidenceForm.status} onChange={handleEvidenceFormChange} required>
                <option value="Pending">Pending</option>
                <option value="Verified">Verified</option>
                <option value="Rejected">Rejected</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowEvidenceModal(false); setEditingEvidence(null); }}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>{loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}{editingEvidence ? 'Save Changes' : 'Add Evidence'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Evidence View Modal */}
      <Modal show={showEvidenceViewModal} onHide={() => setShowEvidenceViewModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Evidence Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewingEvidence && (
            <div>
              <div className="mb-3">
                <h6>Case</h6>
                <p>{viewingEvidence.caseTitle}</p>
              </div>
              <div className="mb-3">
                <h6>Type</h6>
                <p>{viewingEvidence.type}</p>
              </div>
              <div className="mb-3">
                <h6>Description</h6>
                <p>{viewingEvidence.description}</p>
              </div>
              <div className="mb-3">
                <h6>Date Added</h6>
                <p>{viewingEvidence.dateAdded}</p>
              </div>
              <div>
                <h6>Status</h6>
                <p>{viewingEvidence.status}</p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEvidenceViewModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Witness Add/Edit Modal */}
      <Modal show={showWitnessModal} onHide={() => { setShowWitnessModal(false); setEditingWitness(null); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingWitness ? 'Edit Witness' : 'Add Witness'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleWitnessSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" name="name" value={witnessForm.name} onChange={handleWitnessFormChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Case</Form.Label>
              <Form.Select name="caseTitle" value={witnessForm.caseTitle} onChange={handleWitnessFormChange} required>
                <option value="">Select case</option>
                {cases.map(c => (
                  <option key={c.id} value={c.title}>{c.title}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Contact</Form.Label>
              <Form.Control type="text" name="contact" value={witnessForm.contact} onChange={handleWitnessFormChange} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select name="status" value={witnessForm.status} onChange={handleWitnessFormChange} required>
                <option value="Pending">Pending</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Testified">Testified</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowWitnessModal(false); setEditingWitness(null); }}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>{loading ? <Spinner animation="border" size="sm" className="me-2" /> : null}{editingWitness ? 'Save Changes' : 'Add Witness'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Witness View Modal */}
      <Modal show={showWitnessViewModal} onHide={() => setShowWitnessViewModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Witness Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewingWitness && (
            <div>
              <div className="mb-3">
                <h6>Name</h6>
                <p>{viewingWitness.name}</p>
              </div>
              <div className="mb-3">
                <h6>Case</h6>
                <p>{viewingWitness.caseTitle}</p>
              </div>
              <div className="mb-3">
                <h6>Contact</h6>
                <p>{viewingWitness.contact}</p>
              </div>
              <div>
                <h6>Status</h6>
                <p>{viewingWitness.status}</p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowWitnessViewModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Payment Add/Edit Modal */}
      <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingPayment ? 'Edit Payment' : 'Add New Payment'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitPayment}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Case Name</Form.Label>
              <Form.Select
                value={paymentForm.caseid}
                onChange={(e) => {
                  const selected = courtCases.find(c => String(c.caseid) === e.target.value);
                  const lawyers = selected?.lawyers || [];
                  setPaymentForm(prev => ({
                    ...prev,
                    caseName: selected?.title || '',
                    caseid: selected?.caseid || '',
                    caseLawyers: lawyers,
                    // Auto-pick when there's only one lawyer on the case;
                    // a two-sided case makes the registrar choose explicitly.
                    lawyerid: lawyers.length === 1 ? lawyers[0].lawyerid : '',
                    lawyerName: lawyers.length === 1 ? lawyers[0].name : '',
                    clientName: lawyers.length === 1 ? lawyers[0].clientName : '',
                  }));
                }}
                required
              >
                <option value="">Select case</option>
                {courtCases.map(caseItem => (
                  <option key={caseItem.caseid} value={caseItem.caseid}>{caseItem.title}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Lawyer (who owes this payment)</Form.Label>
              <Form.Select
                value={paymentForm.lawyerid}
                onChange={(e) => {
                  const chosen = (paymentForm.caseLawyers || []).find(l => String(l.lawyerid) === e.target.value);
                  setPaymentForm(prev => ({
                    ...prev,
                    lawyerid: chosen?.lawyerid || '',
                    lawyerName: chosen?.name || '',
                    clientName: chosen?.clientName || '',
                  }));
                }}
                required
                disabled={(paymentForm.caseLawyers || []).length === 0}
              >
                <option value="">Select lawyer</option>
                {(paymentForm.caseLawyers || []).map(l => (
                  <option key={l.lawyerid} value={l.lawyerid}>
                    {l.name}{l.side ? ` (${l.side[0].toUpperCase()}${l.side.slice(1)})` : ''}
                  </option>
                ))}
              </Form.Select>
              {paymentForm.caseid && (paymentForm.caseLawyers || []).length === 0 && (
                <Form.Text className="text-danger">No approved lawyer on this case yet.</Form.Text>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Client Name</Form.Label>
              <Form.Control
                type="text"
                value={paymentForm.clientName}
                readOnly
                disabled
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Payment Type</Form.Label>
              <Form.Control
                type="text"
                value={paymentForm.paymentType}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentType: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Purpose</Form.Label>
              <Form.Control
                type="text"
                value={paymentForm.purpose}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, purpose: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Amount</Form.Label>
              <Form.Control
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                required
                min="0"
                step="0.01"
              />
            </Form.Group>
            <Form.Text className="text-muted d-block mb-3">
              Payment mode isn't set here — the lawyer picks it when they
              report the payment as paid, and you verify it from there.
            </Form.Text>
            <Form.Group className="mb-3">
              <Form.Label>Payment Date</Form.Label>
              <Form.Control
                type="date"
                value={paymentForm.paymentDate}
                disabled
                readOnly
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={paymentForm.status}
                disabled
              >
                <option value="Pending">Pending</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">{editingPayment ? 'Update' : 'Add'} Payment</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Payment Delete Confirmation Modal */}
      <Modal show={confirm.show} onHide={() => setConfirm({ show: false, type: '', payload: null })} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this payment record?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirm({ show: false, type: '', payload: null })}>Cancel</Button>
          <Button variant="danger" onClick={() => {
            setCourtPayments(prev => prev.filter(p => p.id !== confirm.payload.id));
            setConfirm({ show: false, type: '', payload: null });
          }}>Delete</Button>
        </Modal.Footer>
      </Modal>

      {/* Prosecutor Add/Edit Modal */}
      <Modal show={showProsecutorModal} onHide={() => setShowProsecutorModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingProsecutor ? 'Edit Prosecutor' : 'Add New Prosecutor'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleProsecutorSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={prosecutorForm.name}
                onChange={handleProsecutorFormChange}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Experience (years)</Form.Label>
              <Form.Control
                type="number"
                name="experience"
                value={prosecutorForm.experience}
                onChange={handleProsecutorFormChange}
                required
                min="0"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                name="status"
                value={prosecutorForm.status}
                onChange={handleProsecutorFormChange}
                required
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Assign Criminal Cases</Form.Label>
              <Form.Select
                multiple
                name="assignedCases"
                value={prosecutorForm.assignedCases}
                onChange={e => {
                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                  setProsecutorForm({ ...prosecutorForm, assignedCases: selectedOptions });
                }}
              >
                {courtCases.filter(case_ => case_.casetype === 'Criminal').map(case_ => (
                  <option key={case_.caseid} value={case_.title}>
                    {case_.title}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Hold Ctrl/Cmd to select multiple cases
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowProsecutorModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingProsecutor ? 'Save Changes' : 'Add Prosecutor'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Judge Assign/Manage Modal */}
      <Modal show={showJudgeModal} onHide={() => setShowJudgeModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingJudge ? 'Manage Case Assignments' : 'Assign Judge to Your Court'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleJudgeSubmit}>
          <Modal.Body>
            {editingJudge ? (
              <div className="mb-3">
                <div className="fw-bold">{editingJudge.name}</div>
                <div className="text-muted small">
                  {editingJudge.position}{editingJudge.specialization ? ` · ${editingJudge.specialization}` : ''}
                </div>
              </div>
            ) : (
              <Form.Group className="mb-3">
                <Form.Label>Judge</Form.Label>
                {loadingAvailableJudges ? (
                  <div className="text-muted small">Loading judges...</div>
                ) : (
                  <Form.Select value={assignJudgeId} onChange={e => setAssignJudgeId(e.target.value)} required>
                    <option value="">Select a judge</option>
                    {availableJudges.map(j => (
                      <option key={j.judgeid} value={j.judgeid}>
                        {j.firstname} {j.lastname} — {j.position || 'Judge'}
                        {j.current_courts ? ` (currently at ${j.current_courts})` : ' (not currently at any court)'}
                      </option>
                    ))}
                  </Form.Select>
                )}
                {!loadingAvailableJudges && availableJudges.length === 0 && (
                  <Form.Text className="text-muted">
                    No approved judges are available to assign right now.
                  </Form.Text>
                )}
                <Form.Text className="text-muted d-block">
                  Judges can serve more than one court — this doesn't remove them from any court shown above.
                </Form.Text>
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Assign Cases</Form.Label>
              <Form.Select
                multiple
                name="assignedCases"
                value={judgeForm.assignedCases}
                onChange={e => {
                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                  setJudgeForm({ ...judgeForm, assignedCases: selectedOptions });
                }}
              >
                {courtCases.map(case_ => (
                  <option key={case_.caseid} value={case_.title}>
                    {case_.title}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Hold Ctrl/Cmd to select multiple cases
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowJudgeModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingJudge ? 'Save Changes' : 'Assign Judge'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Verify Case Modal */}
      <Modal show={showVerifyModal} onHide={() => setShowVerifyModal(false)} centered>
  <Modal.Header closeButton>
    <Modal.Title>Verify Case</Modal.Title>
  </Modal.Header>
  <Form onSubmit={handleVerifySubmit}>
    <Modal.Body>
      {verifyError && <div className="alert alert-danger">{verifyError}</div>}
      {verifySuccess && <div className="alert alert-success">{verifySuccess}</div>}
      <Form.Group className="mb-3">
        <Form.Label>Case Name</Form.Label>
        <Form.Control
          type="text"
          name="casename"
          value={verifyForm.casename}
          readOnly
          disabled
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Type</Form.Label>
        <Form.Control
          type="text"
          name="type"
          value={verifyForm.type}
          readOnly
          disabled
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Filing Date</Form.Label>
        <Form.Control
          type="date"
          name="filingdate"
          value={verifyForm.filingdate}
          readOnly
          disabled
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Client Name</Form.Label>
        <Form.Control type="text" value={verifyForm.clientname} readOnly disabled />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Lawyer Name</Form.Label>
        <Form.Control
          type="text"
          name="lawyername"
          value={verifyForm.lawyername}
          readOnly
          disabled
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Judge</Form.Label>
        <Form.Select
          name="judgename"
          value={verifyForm.judgename}
          onChange={handleVerifyFormChange}
          required
        >
          <option value="">Select judge</option>
          {judgeOptions.map(j => (
            <option key={j.judgeid} value={j.name}>{j.name}</option>
          ))}
        </Form.Select>
      </Form.Group>
      {verifyForm.type === 'Criminal' && (
        <Form.Group className="mb-3">
          <Form.Label>Prosecutor</Form.Label>
          <Form.Select
            name="prosecutorname"
            value={verifyForm.prosecutorname}
            onChange={handleVerifyFormChange}
            required
          >
            <option value="">Select prosecutor</option>
            {prosecutorOptions.filter(p => p.status === 'Active').map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </Form.Select>
          <Form.Text className="text-muted">Required because the prosecutor represents the State.</Form.Text>
        </Form.Group>
      )}
      <Form.Text className="text-muted d-block mb-3">
        An opposing lawyer isn't attached here — they join via "Join Existing Case"
        from their own dashboard (selecting which client they represent), and you
        approve that request from Pending Lawyer Join Requests.
      </Form.Text>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={() => setShowVerifyModal(false)}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" disabled={verifyLoading}>
        {verifyLoading ? 'Verifying...' : 'Verify'}
      </Button>
    </Modal.Footer>
  </Form>
</Modal>
    </div>
  );
};

export default RegistrarDashboard; 
