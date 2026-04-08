import React from 'react';
import { Task } from '../types';

interface ReportsViewProps {
  tasks: Task[];
}

export default function ReportsView({ tasks }: ReportsViewProps) {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Reports</h2>
      <p>Total Tasks: {tasks.length}</p>
    </div>
  );
}
