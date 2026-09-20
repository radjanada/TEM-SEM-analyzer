
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadIcon } from './icons';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    if (rejectedFiles.length > 0) {
      setError('Invalid file type. Please upload a JPG, PNG, TIF, or BMP image.');
      return;
    }
    if (acceptedFiles.length > 0) {
      onImageUpload(acceptedFiles[0]);
    }
  }, [onImageUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tif', '.tiff'],
      'image/bmp': ['.bmp'],
    },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`p-10 border-4 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
        isDragActive ? 'border-cyan-400 bg-gray-700' : 'border-gray-600 hover:border-cyan-500 hover:bg-gray-800'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center text-center">
        <UploadIcon className="w-16 h-16 text-gray-500 mb-4 transition-transform duration-300 transform group-hover:scale-110" />
        {isDragActive ? (
          <p className="text-xl font-semibold text-cyan-300">Drop the image here ...</p>
        ) : (
          <div>
            <p className="text-xl font-semibold text-white">Drag & drop your image here</p>
            <p className="text-gray-400 mt-1">or click to select a file</p>
            <p className="text-xs text-gray-500 mt-4">Supported formats: JPG, PNG, TIF, BMP</p>
          </div>
        )}
        {error && <p className="text-red-400 mt-4">{error}</p>}
      </div>
    </div>
  );
};

export default ImageUploader;
