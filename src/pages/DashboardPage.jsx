
import { FiLogOut, FiHome, FiSettings, FiUsers } from "react-icons/fi"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { message } from "antd"
import { BarChart2Icon } from "lucide-react"

function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    message.success("Logged out successfully")
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-64 h-screen bg-white shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg mb-3">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Contractor Hub</h1>
          <p className="text-xs text-gray-500 mt-1">Admin Dashboard</p>
        </div>

        <nav className="p-6 space-y-2">
          <NavItem icon={FiHome} label="Dashboard" active />
          <NavItem icon={FiUsers} label="Team Members" />
          <NavItem icon={BarChart2Icon} label="Reports" />
          <NavItem icon={FiSettings} label="Settings" />
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            <FiLogOut size={20} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Welcome Back!</h2>
            <p className="text-gray-600 mt-1">Logged in as: {user?.email || "User"}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Today</p>
            <p className="text-lg font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Revenue" value="$87,100" change="+12.5%" />
          <StatCard title="Active Projects" value="25" change="+3" />
          <StatCard title="Team Members" value="12" change="+2" />
          <StatCard title="Conversion Rate" value="68%" change="+5.2%" />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ActionButton label="Create New Quote" />
              <ActionButton label="View Reports" />
              <ActionButton label="Schedule Follow-up" />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h3>
            <div className="space-y-4">
              <ActivityItem title="New project created" time="2 hours ago" />
              <ActivityItem title="Quote accepted" time="5 hours ago" />
              <ActivityItem title="Team member added" time="1 day ago" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavItem({ icon: Icon, label, active = false }) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition duration-200 ${
        active ? "bg-blue-100 text-blue-600 font-semibold" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  )
}

function StatCard({ title, value, change }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <p className="text-gray-600 text-sm mb-2">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      <p className="text-green-600 text-sm font-semibold">{change} from last month</p>
    </div>
  )
}

function ActionButton({ label }) {
  return (
    <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200">
      {label}
    </button>
  )
}

function ActivityItem({ title, time }) {
  return (
    <div className="pb-4 border-b border-gray-200 last:border-b-0">
      <p className="text-gray-900 font-medium">{title}</p>
      <p className="text-gray-500 text-sm">{time}</p>
    </div>
  )
}

export default DashboardPage
