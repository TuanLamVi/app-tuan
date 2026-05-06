import React from 'react';
import { cn } from '../../core/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
}

export default function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  return (
    <div 
      className={cn(
        "animate-pulse bg-gray-100",
        variant === 'circular' ? "rounded-full" : variant === 'text' ? "rounded-md h-4 w-full" : "rounded-3xl",
        className
      )}
    />
  );
}

export const TransactionSkeleton = () => (
  <div className="bg-white p-4 rounded-3xl flex gap-4 border border-gray-50">
    <Skeleton variant="rectangular" className="w-12 h-12 rounded-2xl flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="flex justify-between">
        <Skeleton variant="text" className="w-1/3" />
        <Skeleton variant="text" className="w-1/4" />
      </div>
      <Skeleton variant="text" className="w-full h-8" />
      <Skeleton variant="text" className="w-1/2" />
    </div>
  </div>
);

export const GroupCardSkeleton = () => (
  <div className="bg-white p-6 rounded-[40px] border border-gray-100 space-y-4">
    <div className="flex justify-between items-start">
      <Skeleton variant="rectangular" className="w-16 h-16 rounded-2xl" />
      <Skeleton variant="rectangular" className="w-10 h-6 rounded-lg" />
    </div>
    <Skeleton variant="text" className="w-3/4 h-6" />
    <Skeleton variant="text" className="w-full h-10" />
    <div className="flex justify-between items-end pt-2">
       <Skeleton variant="text" className="w-1/3 h-8" />
       <Skeleton variant="circular" className="w-12 h-12" />
    </div>
  </div>
);
