import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { mean, median, max, min, sum, groupBy, countBy } from 'lodash';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI('API');

function App() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [insights, setInsights] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        setData(results.data);
        setColumns(Object.keys(results.data[0]));
        generateSummary(results.data);
        await generateInsights(results.data);
      },
    });
  };

  const generateSummary = (data) => {
    const numericColumns = columns.filter(col => 
      !isNaN(data[0][col])
    );

    const summary = {};
    numericColumns.forEach(col => {
      const values = data.map(row => parseFloat(row[col])).filter(val => !isNaN(val));
      summary[col] = {
        mean: mean(values).toFixed(2),
        median: median(values).toFixed(2),
        max: max(values).toFixed(2),
        min: min(values).toFixed(2),
        sum: sum(values).toFixed(2)
      };
    });

    setSummary(summary);
  };

  const generateInsights = async (data) => {
    try {
      setLoading(true);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // Prepare data summary for AI analysis
      const dataDescription = JSON.stringify({
        totalRecords: data.length,
        columns: columns,
        sampleData: data.slice(0, 5),
        summary: summary
      });

      const prompt = `Analyze this dataset and provide 5 key business insights. Format each insight as a complete sentence. Dataset summary: ${dataDescription}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const insights = response.text().split('\n').filter(insight => insight.trim());
      setInsights(insights);
    } catch (error) {
      console.error('Error generating insights:', error);
      setInsights(['Error generating insights. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const newMessage = { role: 'user', content: userInput };
    setChatMessages(prev => [...prev, newMessage]);
    setUserInput('');

    try {
      setLoading(true);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const dataContext = `Dataset has ${data.length} records with columns: ${columns.join(', ')}. `;
      const prompt = `${dataContext}\n\nUser question: ${userInput}\n\nProvide a concise analysis based on the data.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.text() }]);
      
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">AI-Powered Data Analysis Dashboard</h1>
        
        {/* File Upload */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload CSV File</h2>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {data.length > 0 && (
          <>
            {/* AI Insights */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold mb-4">AI-Generated Insights</h2>
              {loading ? (
                <p>Generating insights...</p>
              ) : (
                <ul className="list-disc pl-5 space-y-2">
                  {insights.map((insight, index) => (
                    <li key={index} className="text-gray-700">{insight}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Chat Interface */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold mb-4">AI Analysis Chat</h2>
              <div 
                ref={chatRef}
                className="h-96 overflow-y-auto mb-4 p-4 border rounded-lg"
              >
                {chatMessages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                  >
                    <div 
                      className={`inline-block p-3 rounded-lg ${
                        msg.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="text-gray-500">AI is thinking...</div>
                )}
              </div>
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Ask a question about your data..."
                  className="flex-1 p-2 border rounded"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  Send
                </button>
              </form>
            </div>

            {/* Data Summary */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold mb-4">Statistical Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary && Object.entries(summary).map(([col, stats]) => (
                  <div key={col} className="border p-4 rounded">
                    <h3 className="font-semibold">{col}</h3>
                    <ul className="mt-2">
                      <li>Mean: {stats.mean}</li>
                      <li>Median: {stats.median}</li>
                      <li>Max: {stats.max}</li>
                      <li>Min: {stats.min}</li>
                      <li>Sum: {stats.sum}</li>
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Visualizations */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold mb-4">Data Visualization</h2>
              <div className="space-y-8">
                {summary && Object.keys(summary).map((col) => (
                  <div key={col} className="border p-4 rounded">
                    <h3 className="font-semibold mb-4">{col} - Line Chart</h3>
                    <LineChart width={800} height={300} data={data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={columns[0]} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey={col} stroke="#8884d8" />
                    </LineChart>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Data Table</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column} className="px-4 py-2 bg-gray-50">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 10).map((row, index) => (
                      <tr key={index}>
                        {columns.map((column) => (
                          <td key={column} className="border px-4 py-2">{row[column]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;