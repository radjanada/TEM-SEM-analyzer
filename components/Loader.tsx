
import React from 'react';
import { RobotIcon } from './icons';

interface LoaderProps {
  message: string;
}

const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex flex-col items-center justify-center z-50">
      <RobotIcon className="w-20 h-20 text-cyan-400 animate-bounce" />
      <p className="text-white text-xl font-semibold mt-4">{message}</p>
    </div>
  );
};

export default Loader;
