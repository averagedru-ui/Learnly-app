import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// This bridge connects the Brain (App.jsx) to the html (index.html)
ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
)

