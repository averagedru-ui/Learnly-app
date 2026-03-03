import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// This must be named main.jsx and stay inside the src folder
ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
)

