"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, X, Filter, SortAsc } from "lucide-react";
import { FilterState } from "@/app/state/satelliteStore";

interface SearchBarProps {
  onSearchChange: (searchTerm: string) => void;
  onFilterChange: (filters: FilterState) => void;
  searchTerm: string;
  filters: FilterState;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearchChange,
  onFilterChange,
  searchTerm,
  filters,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExpanded]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localSearchTerm);
  };

  const handleClearSearch = () => {
    setLocalSearchTerm("");
    onSearchChange("");
  };

  return (
    <div className="fixed top-4 left-4 z-50" ref={searchRef}>
      <div className="bg-gray-800/90 backdrop-blur-sm border border-gray-600 rounded-lg p-2 flex items-center space-x-1">
        {/* Search Input */}
        <div className="relative">
          <form onSubmit={handleSearchSubmit} className="flex items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                className="w-48 px-10 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {localSearchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
