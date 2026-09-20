
import React from 'react';
import { MicroscopeIcon } from './icons';

const Header: React.FC = () => {
  return (
    <header className="text-center p-4 rounded-lg bg-gray-800/50 border border-gray-700">
      <div className="flex items-center justify-center gap-4">
        <MicroscopeIcon className="w-12 h-12 text-cyan-400" />
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            TEM/SEM Image Analysis Tool
          </h1>
          <p className="mt-2 text-lg text-gray-300">
            AI-powered nanoparticle and morphology interpretation from microscopy images.
          </p>
        </div>
      </div>
    </header>
  );
};

export default Header;
