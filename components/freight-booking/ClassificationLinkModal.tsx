"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Select, Label, Badge, Spinner, TextInput, Alert } from "flowbite-react";
import { HiCheck, HiExclamation, HiSearch, HiInformationCircle } from "react-icons/hi";
import { getFreightClassifications, searchFreightClassifications } from "@/helpers/getData";
import type { SelectFreightClassification } from "@/types/db/types";

interface ClassificationLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  productSku: string;
  productName: string;
  onLink: (classificationId: number) => Promise<void>;
}

export default function ClassificationLinkModal({
  isOpen,
  onClose,
  productSku,
  productName,
  onLink,
}: ClassificationLinkModalProps) {
  const [classifications, setClassifications] = useState<SelectFreightClassification[]>([]);
  const [filteredClassifications, setFilteredClassifications] = useState<SelectFreightClassification[]>([]);
  const [selectedClassificationId, setSelectedClassificationId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SelectFreightClassification[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadClassifications();
      findSuggestions();
    }
  }, [isOpen, productName]);

  const loadClassifications = async () => {
    setLoading(true);
    try {
      const data = await getFreightClassifications();
      setClassifications(data || []);
      setFilteredClassifications(data || []);
    } catch (error) {
      console.error("Error loading classifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const findSuggestions = async () => {
    // Smart matching for product name
    const keywords = productName.toLowerCase();
    
    // Special case for Petroleum Ether
    if (keywords.includes("petroleum ether")) {
      const results = await searchFreightClassifications("petroleum ether");
      setSuggestions(results || []);
    } else {
      // Extract key chemical terms
      const chemicalTerms = productName.split(/[\s\-]+/)
        .filter(term => term.length > 3 && !['grade', 'technical', 'reagent', 'gallon', 'drum', 'pail'].includes(term.toLowerCase()));
      
      if (chemicalTerms.length > 0) {
        const results = await searchFreightClassifications(chemicalTerms[0]);
        setSuggestions(results?.slice(0, 3) || []);
      }
    }
  };

  useEffect(() => {
    if (searchQuery) {
      const filtered = classifications.filter(c =>
        c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.nmfc?.includes(searchQuery) ||
        c.hazardId?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredClassifications(filtered);
    } else {
      setFilteredClassifications(classifications);
    }
  }, [searchQuery, classifications]);

  const handleLink = async () => {
    if (!selectedClassificationId) return;
    
    setLinking(true);
    try {
      await onLink(parseInt(selectedClassificationId));
      onClose();
    } catch (error) {
      console.error("Error linking classification:", error);
    } finally {
      setLinking(false);
    }
  };

  const selectedClassification = classifications.find(
    c => c.classificationId === parseInt(selectedClassificationId)
  );

  return (
    <Modal show={isOpen} onClose={onClose} size="2xl">
      <Modal.Header>Link Freight Classification</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          {/* Product Info */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Product Details</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">SKU: {productSku}</p>
            <p className="mt-1 text-gray-700 dark:text-gray-300">{productName}</p>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && !selectedClassificationId && (
            <Alert color="info" icon={HiInformationCircle}>
              <div>
                <p className="font-semibold">Suggested Classifications</p>
                <div className="mt-2 space-y-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.classificationId}
                      onClick={() => setSelectedClassificationId(suggestion.classificationId?.toString() || "")}
                      className="w-full rounded-lg border border-blue-300 bg-blue-50 p-3 text-left transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {suggestion.description}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge color="gray">NMFC: {suggestion.nmfc}</Badge>
                            <Badge color="blue">Class: {suggestion.freightClass}</Badge>
                            {suggestion.hazardous && (
                              <Badge color="warning">Hazmat: {suggestion.hazardId}</Badge>
                            )}
                          </div>
                        </div>
                        <HiCheck className="h-5 w-5 text-blue-600" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Alert>
          )}

          {/* Search */}
          <div>
            <Label htmlFor="search" value="Search Classifications" />
            <TextInput
              id="search"
              type="text"
              icon={HiSearch}
              placeholder="Search by description, NMFC, or hazard ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Classification Dropdown */}
          <div>
            <Label htmlFor="classification" value="Select Classification" />
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size="md" />
              </div>
            ) : (
              <Select
                id="classification"
                value={selectedClassificationId}
                onChange={(e) => setSelectedClassificationId(e.target.value)}
                required
              >
                <option value="">Choose a classification...</option>
                {filteredClassifications.map((classification) => (
                  <option
                    key={classification.classificationId}
                    value={classification.classificationId}
                  >
                    {classification.description} - NMFC: {classification.nmfc} - Class: {classification.freightClass}
                    {classification.hazardous ? " (HAZMAT)" : ""}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Selected Classification Preview */}
          {selectedClassification && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/30">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Selected Classification
              </h4>
              <div className="mt-2 space-y-1">
                <p className="text-sm">
                  <span className="font-medium">Description:</span> {selectedClassification.description}
                </p>
                <p className="text-sm">
                  <span className="font-medium">NMFC:</span> {selectedClassification.nmfc}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Freight Class:</span> {selectedClassification.freightClass}
                </p>
                {selectedClassification.hazardous && (
                  <>
                    <p className="text-sm">
                      <span className="font-medium">Hazard ID:</span> {selectedClassification.hazardId}
                    </p>
                    {selectedClassification.packingGroup && (
                      <p className="text-sm">
                        <span className="font-medium">Packing Group:</span> {selectedClassification.packingGroup}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button
          color="blue"
          onClick={handleLink}
          disabled={!selectedClassificationId || linking}
        >
          {linking ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Linking...
            </>
          ) : (
            "Link Classification"
          )}
        </Button>
        <Button color="gray" onClick={onClose} disabled={linking}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}