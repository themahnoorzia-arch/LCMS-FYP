// components/Sidebar.jsx
import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaGavel, FaCalendarAlt, FaUserCircle, FaSignOutAlt } from 'react-icons/fa';

function Sidebar() {
    return (
        <div className="bg-dark text-white vh-100 p-3" style={{ width: '250px' }}>
            <h4 className="text-center mb-4">Lawyer Panel</h4>
            <ul className="nav flex-column">
                <li className="nav-item mb-3">
                    <a href="#" className="nav-link text-white">
                        <FaGavel className="me-2" />
                        My Cases
                    </a>
                </li>
                <li className="nav-item mb-3">
                    <a href="#" className="nav-link text-white">
                        <FaCalendarAlt className="me-2" />
                        Appointments
                    </a>
                </li>
                <li className="nav-item mb-3">
                    <a href="#" className="nav-link text-white">
                        <FaUserCircle className="me-2" />
                        Profile
                    </a>
                </li>
                <li className="nav-item mt-4">
                    <a href="#" className="nav-link text-danger">
                        <FaSignOutAlt className="me-2" />
                        Logout
                    </a>
                </li>
            </ul>
        </div>
    );
}

export default Sidebar;
