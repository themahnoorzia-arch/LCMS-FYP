import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css'; // Import Bootstrap CSS if needed in this component

function CaseHistory() {
    // --- Temporary/Placeholder Data for Case History ---
    // In a real application, you would fetch this data from an API
    const caseHistories = [
        {
            id: 1,
            caseNumber: 'Case #123',
            description: 'Injury claim from car accident',
            history: [
                'Filed initial claim - 2023-01-10',
                'Discovery phase completed - 2023-05-15',
                'Settlement negotiation started - 2023-07-01',
                'Court hearing scheduled - 2023-09-20',
                'Final hearing held - 2023-11-05',
            ],
            finalDecision: 'Case settled out of court.',
        },
        {
            id: 2,
            caseNumber: 'Case #456',
            description: 'Property dispute over land boundary',
            history: [
                'Complaint filed - 2024-02-01',
                'Response filed by other party - 2024-03-10',
                'Mediation attempted - 2024-05-25',
                'Trial date set - 2024-08-15',
            ],
            finalDecision: 'Pending Trial', // Example of a pending decision
        },
        // Add more case history data here with unique IDs
        {
            id: 3,
            caseNumber: 'Case #789',
            description: 'Contract disagreement with vendor',
            history: [
                'Contract reviewed - 2024-01-05',
                'Negotiations held - 2024-02-14',
                'Terms revised - 2024-03-20',
            ],
            finalDecision: 'Agreement reached, contract amended.',
        },
    ];
    // --- End Temporary Data ---

    return (
    <div className="container mt-4">
        <h2 className="h4">Case History</h2>

        <div className="row">
            {caseHistories.length > 0 ? (
                caseHistories.map((historyItem) => (
                    <div key={historyItem.id} className="col-md-6 mb-4">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title">{historyItem.caseNumber}</h5>
                                <h6 className="card-subtitle mb-2 text-muted">{historyItem.description}</h6>

                                <p className="card-text"><strong>History:</strong></p>
                                {historyItem.history && historyItem.history.length > 0 ? (
                                    <ul>
                                        {historyItem.history.map((point, index) => (
                                            <li key={index}>{point}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No detailed history available.</p>
                                )}

                                <p className="card-text mt-3">
                                    <strong>Final Decision:</strong> {historyItem.finalDecision}
                                </p>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="col-12">
                    <div className="alert alert-info" role="alert">
                        No case history available.
                    </div>
                </div>
            )}
        </div>
    </div>
);

}

export default CaseHistory; // Export the component