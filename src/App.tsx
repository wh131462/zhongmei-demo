import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { CalendarDays, MessageSquare, Database } from 'lucide-react';
import ReportPage from './pages/ReportPage';
import ChatPage from './pages/ChatPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* 顶部导航 */}
        <nav className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center h-14">
              <span className="text-lg font-bold text-blue-600 mr-8">中煤 Demo</span>
              <div className="flex space-x-1">
                <NavLink
                  to="/report"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <CalendarDays size={16} />
                  报告
                </NavLink>
                <NavLink
                  to="/chat"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <MessageSquare size={16} />
                  AI 对话
                </NavLink>
                <NavLink
                  to="/knowledge"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <Database size={16} />
                  知识库
                </NavLink>
              </div>
            </div>
          </div>
        </nav>

        {/* 页面内容 */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/knowledge" element={<KnowledgeBasePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
