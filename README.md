# LegalCaseManagementSystem

## Quick Start

1. **Setup backend:**
   ```bash
   cd LegalCaseManagementSystem/backend
   pip install flask flask-login flask-cors flask-session sqlalchemy psycopg2-binary werkzeug python-dotenv
   python create_tables.py
   ```

2. **Setup and build frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run build
   ```

3. **Run the application:**
   ```bash
   cd ../backend
   python app.py
   ```

4. **Access the application:**
   Open `http://localhost:5000` in your browser

## Detailed Setup Instructions

### Prerequisites
- Python 3.7+
- PostgreSQL database (Supabase recommended)
- Node.js (for frontend)

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd LegalCaseManagementSystem/backend
   ```

2. **Install required Python packages:**
   ```bash
   pip install flask flask-login flask-cors flask-session sqlalchemy psycopg2-binary werkzeug
   ```

3. **Set up environment variables:**
   Create a `.env` file in the backend directory with:
   ```
   DATABASE_URL=your_postgresql_connection_string
   SESSION_TYPE=filesystem
   ```
   Or modify the default connection in `config.py`.

4. **Create database tables:**
   ```bash
   python create_tables.py
   ```

5. **Run the Flask backend:**
   ```bash
   python app.py
   ```
   The backend will start on `http://localhost:5000` and serve both the API and the frontend.

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd LegalCaseManagementSystem/frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the frontend:**
   ```bash
   npm run build
   ```
   This creates the production build in the `dist` folder.

4. **Run the backend (which serves the frontend):**
   ```bash
   cd ../backend
   python app.py
   ```

5. **Access the application:**
   The full application will be accessible at `http://localhost:5000`

## Project Overview

# Home Page:
 <img width="1072" height="475" alt="image" src="https://github.com/user-attachments/assets/3e99fc48-ae0d-40df-9afa-de56c88f1554" />

Displays the landing page of the Legal Case Management System, highlighting its purpose to simplify case management
Dashboards:
<img width="1072" height="525" alt="image" src="https://github.com/user-attachments/assets/6127023e-09fa-467d-99cc-c25fd51271c5" />

 Shows the dashboard view for a Court Registrar, providing quick actions for managing court rooms, cases, and appeals
 <img width="1072" height="524" alt="image" src="https://github.com/user-attachments/assets/a732e4ce-fb62-444d-9f19-73e77c939849" />

Illustrates the dashboard for a Lawyer, featuring a list of assigned cases with details and action options
<img width="1072" height="510" alt="image" src="https://github.com/user-attachments/assets/7361d571-fd6e-4c9c-a667-bd6340b98404" />

Displays the Judge's interface showing assigned cases with options to view history, evidence, witnesses, and decisions
 <img width="1072" height="517" alt="image" src="https://github.com/user-attachments/assets/edf8f93e-ab36-43f3-90a5-827017aa4eea" />

Shows the Client's view of their cases, including case title, assigned lawyer and court, status, and history
 

<img width="1072" height="521" alt="image" src="https://github.com/user-attachments/assets/4e42bca8-7751-4dbe-a04a-8ad8de368d57" />


Displays the Admin dashboard showing system logs, including action type, description, status, and timestamp for tracking changes
 


#Some buttons\functionalities:
<img width="1072" height="514" alt="image" src="https://github.com/user-attachments/assets/9b2cc1f4-aa81-4444-81fe-ba7954825b1b" />

A pop-up window showing the final decision details for a case, including decision date, summary, and verdict

 <img width="1072" height="523" alt="image" src="https://github.com/user-attachments/assets/32258d20-9b3f-4836-8d5a-41eeda9c4008" />

Depicts a calendar interface, used for scheduling and viewing hearing dates

 <img width="1072" height="516" alt="image" src="https://github.com/user-attachments/assets/ffdd3b84-1009-4775-ae77-774d9801928c" />

A pop-up window allowing the editing of hearing details, such as case name, date, time, venue, and judge

 <img width="1035" height="510" alt="image" src="https://github.com/user-attachments/assets/52624ec9-52b3-4eac-9c69-b5622c4815f7" />




Shows a pop-up form for judges to announce the final decision of a case by entering the verdict, date, and summary

 <img width="1047" height="536" alt="image" src="https://github.com/user-attachments/assets/2b2ad721-a208-4476-9326-2710f6c011d8" />


A pop-up box for adding remarks or notes related to a specific hearing.
 


#Backend:
The backend coding was done by using Flask to create API’s which were called through the frontend. 
First, an API endpoint would be defined in flask like so:

 <img width="610" height="1003" alt="image" src="https://github.com/user-attachments/assets/e5513419-aba8-406f-9344-877ac0800d8c" />

Demonstrates the Flask code for defining an API endpoint to fetch appeals data for the frontend.

Then the API would be tested in postman:
 <img width="920" height="471" alt="image" src="https://github.com/user-attachments/assets/e02c0a7b-28f4-434e-9f04-712becfdfb4b" />

Shows the successful testing of the backend API endpoint using Postman, confirming it returns the expected data

After receiving confirmation of the APIs working, then the API call would be included in the frontend.

#Workflow for connecting frontend and backend:
The API calls for CRUD operations would be included in the frontend code as such:
 <img width="515" height="546" alt="image" src="https://github.com/user-attachments/assets/50a091c2-2373-4ea9-819b-64445755b60c" />

Illustrates the frontend code using React to call the backend API to retrieve and display appeals

The results of which can be seen as follows:
<img width="1072" height="498" alt="image" src="https://github.com/user-attachments/assets/e9581c12-be6a-4e0b-abc9-6049a7531f03" />

 




