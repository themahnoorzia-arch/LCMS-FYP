import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css'; // Import Bootstrap CSS if needed

function MyCases() {
  const cases = [
    {
      id: 1,
      caseNumber: 'Case #123',
      description: 'Injury claim from car accident involving multiple parties.',
      assignedLawyer: 'Attorney Jane Doe',
      otherLawyers: ['Attorney Bob Johnson'],
      judge: 'Judge Alice Williams',
      prosecutor: 'Prosecutor David Green',
      status: 'Active',
      detailedDescription: 'Detailed overview of the car accident circumstances, injuries sustained, and parties involved. Includes police report details and initial medical assessments.',
      relatedDocuments: [{ id: 101, name: 'Accident Report.pdf' }, { id: 102, name: 'Medical Bills.pdf' }],
      relatedHearings: [{ id: 201, date: '2025-05-15 10:00', location: 'Courtroom 3A' }],
      evidence: [{ id: 301, description: 'Photos of vehicle damage' }, { id: 302, description: 'Witness statement video' }],
      witnesses: [{ id: 401, name: 'John Smith' }, { id: 402, name: 'Emily Davis' }],
      caseHistoryId: 1,
      finalDecisionId: null,
    },
    {
      id: 2,
      caseNumber: 'Case #456',
      description: 'Property dispute over land boundary in urban area.',
      assignedLawyer: 'Attorney John Smith',
      otherLawyers: [],
      judge: 'Judge Robert Davis',
      prosecutor: null,
      status: 'Pending Mediation',
      detailedDescription: 'Detailed history of the property ownership, boundary surveys, and points of contention between neighbors. Includes legal precedents cited.',
      relatedDocuments: [{ id: 103, name: 'Deed.pdf' }, { id: 104, name: 'Survey Map.jpg' }],
      relatedHearings: [{ id: 202, date: '2025-06-20 14:30', location: 'Mediation Center' }],
      evidence: [{ id: 303, description: 'Boundary survey report' }],
      witnesses: [],
      caseHistoryId: 2,
      finalDecisionId: null,
    },
    {
      id: 3,
      caseNumber: 'Case #789',
      description: 'Contract disagreement with vendor.',
      assignedLawyer: 'Attorney Jane Doe',
      otherLawyers: [],
      judge: 'Judge Alice Williams',
      prosecutor: null,
      status: 'Closed',
      detailedDescription: 'Dispute over the terms and fulfillment of a vendor contract.',
      relatedDocuments: [{ id: 105, name: 'Vendor Contract.pdf' }, { id: 106, name: 'Amendment.pdf' }],
      relatedHearings: [],
      evidence: [],
      witnesses: [],
      caseHistoryId: 3,
      finalDecisionId: 1,
    },
  ];

  const [caseList] = useState(cases);
  const [selectedCase, setSelectedCase] = useState(null);

  const handleViewCase = (caseId) => {
    const caseToView = caseList.find(caseItem => caseItem.id === caseId);
    setSelectedCase(caseToView);
  };

  const handleBackToList = () => {
    setSelectedCase(null);
  };

  return (
    <div className="container mt-4">
      <h2 className="h4">My Cases</h2>

      {selectedCase ? (
        <div>
          <button className="btn btn-secondary btn-sm mb-3" onClick={handleBackToList}>
            &larr; Back to List
          </button>

          <h3 className="h5 mb-3">{selectedCase.caseNumber} Details</h3>

          <p><strong>Status:</strong> {selectedCase.status}</p>
          <p><strong>Assigned Lawyer:</strong> {selectedCase.assignedLawyer}</p>
          {selectedCase.judge && <p><strong>Judge:</strong> {selectedCase.judge}</p>}
          {selectedCase.prosecutor && <p><strong>Prosecutor/Opposing Counsel:</strong> {selectedCase.prosecutor}</p>}

          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title h6">Case Description</h5>
              <p className="card-text">{selectedCase.detailedDescription}</p>
            </div>
          </div>

          <div className="mb-3">
            <h5 className="h6">Related Documents:</h5>
            {selectedCase.relatedDocuments?.length > 0 ? (
              <ul>
                {selectedCase.relatedDocuments.map((doc) => (
                  <li key={doc.id}>{doc.name}</li>
                ))}
              </ul>
            ) : (
              <p><small>No documents linked yet.</small></p>
            )}
          </div>

          <div className="mb-3">
            <h5 className="h6">Upcoming Hearings:</h5>
            {selectedCase.relatedHearings?.length > 0 ? (
              <ul>
                {selectedCase.relatedHearings.map((hearing) => (
                  <li key={hearing.id}>{hearing.date} ({hearing.location})</li>
                ))}
              </ul>
            ) : (
              <p><small>No upcoming hearings linked yet.</small></p>
            )}
          </div>

          <div className="mb-3">
            <h5 className="h6">Evidence:</h5>
            {selectedCase.evidence?.length > 0 ? (
              <ul>
                {selectedCase.evidence.map((item) => (
                  <li key={item.id}>{item.description}</li>
                ))}
              </ul>
            ) : (
              <p><small>No evidence listed yet.</small></p>
            )}
          </div>

          <div className="mb-3">
            <h5 className="h6">Witnesses:</h5>
            {selectedCase.witnesses?.length > 0 ? (
              <ul>
                {selectedCase.witnesses.map((person) => (
                  <li key={person.id}>{person.name}</li>
                ))}
              </ul>
            ) : (
              <p><small>No witnesses listed yet.</small></p>
            )}
          </div>

          <div className="mb-3">
            <h5 className="h6">Timeline/History Summary:</h5>
            {selectedCase.caseHistoryId ? (
              <p><small>Case history is available.</small></p>
            ) : (
              <p><small>No detailed timeline available.</small></p>
            )}
          </div>

          <div className="mb-3">
            <h5 className="h6">Final Decision:</h5>
            {selectedCase.finalDecisionId ? (
              <p><small>A final decision has been recorded.</small></p>
            ) : (
              <p><small>Final decision is pending or not recorded yet.</small></p>
            )}
          </div>
        </div>
      ) : (
        <div className="list-group"> {/* --- Case List View --- */}
          {caseList.length === 0 ? (
            <div className="alert alert-info" role="alert">
              No cases assigned yet.
            </div>
          ) : (
            caseList.map(caseItem => (
              <button
                key={caseItem.id}
                type="button"
                className="list-group-item list-group-item-action"
                onClick={() => handleViewCase(caseItem.id)}
              >
                {caseItem.caseNumber} - {caseItem.description}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default MyCases;
