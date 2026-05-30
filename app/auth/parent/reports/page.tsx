'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ParentSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { href: '/parent', label: '🏠 Overview' },
    { href: '/parent/attendance', label: '📋 Attendance' },
    { href: '/parent/homework', label: '📚 Homework' },
    { href: '/parent/marks', label: '📊 Marks' },
    { href: '/parent/report', label: '📈 Report' },        // ← NEW
    { href: '/parent/announcements', label: '📢 Announcements' },
    { href: '/parent/feedback', label: '💬 Feedback' },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 bg-[#1e2937] p-6 border-r border-gray-700 min-h-screen">
      <div className="flex items-center gap-2 mb-8">
        <span className="text-2xl">👨‍👩‍👧</span>
        <h1 className="text-2xl font-bold text-blue-400">Parent Portal</h1>
      </div>

      <nav className="flex flex-col gap-2 flex-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
              pathname === item.href 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-gray-800 text-gray-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        onClick={() => {/* your logout logic */}}
        className="mt-6 bg-red-600 hover:bg-red-500 p-3 rounded-xl font-medium"
      >
        Logout
      </button>
    </div>
  );
}