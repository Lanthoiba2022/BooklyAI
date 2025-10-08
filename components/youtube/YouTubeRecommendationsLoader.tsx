"use client";
import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Play } from "lucide-react";

interface YouTubeRecommendationsLoaderProps {
  className?: string;
}

export function YouTubeRecommendationsLoader({ className }: YouTubeRecommendationsLoaderProps) {
  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Play className="h-5 w-5 text-red-500" />
        <h3 className="text-lg font-semibold">Loading Video Recommendations...</h3>
      </div>

      {/* Video Grid Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <div className="relative">
              <Skeleton className="w-full h-32 rounded-t-lg" />
              <div className="absolute bottom-2 right-2">
                <Skeleton className="h-4 w-8 bg-black/20" />
              </div>
            </div>
            
            <CardHeader className="p-3">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </CardHeader>

            <CardContent className="p-3 pt-0">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function YouTubeRecommendationsCompactLoader({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <Play className="h-4 w-4 text-red-500" />
        <Skeleton className="h-4 w-32" />
      </div>
      
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 p-2 rounded-lg border">
            <Skeleton className="w-12 h-8 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-6 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}
