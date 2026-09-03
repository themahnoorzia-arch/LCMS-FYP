// components/Topbar.jsx
import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaBell, FaUserCircle } from 'react-icons/fa';

function TopBar() {
    return (
        <nav className="navbar navbar-expand-lg navbar-light bg-light px-4 shadow-sm">
            <div className="container-fluid justify-content-between">
                <span className="navbar-brand mb-0 h4">Welcome, Lawyer</span>
                <div className="d-flex align-items-center gap-3">
                    <FaBell size={20} className="text-secondary" />
                    <FaUserCircle size={24} className="text-primary" />
                </div>
            </div>
        </nav>
    );
}

export default TopBar;
