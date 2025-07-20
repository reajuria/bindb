/**
 * SlotManager - Handles slot allocation, tracking, and reuse
 */

/**
 * Slot data for loading existing slots
 */
export interface SlotData {
  slot: number;
  id: string | null;
}

/**
 * Slot statistics
 */
export interface SlotStats {
  totalSlots: number;
  activeSlots: number;
  freeSlots: number;
  slotUtilization: number;
}

export class SlotManager {
  private idMap: (string | null)[] = [];        // Array mapping slot index to record ID
  private idToSlot: Map<string, number> = new Map(); // Reverse lookup: id -> slot index  
  private freeSlots: number[] = [];             // Stack of available slots for reuse

  /**
   * Find an empty slot for a new record
   * @returns 1-based slot index
   */
  findEmptySlot(): number {
    // Reuse a deleted slot if available, otherwise append new slot
    return this.freeSlots.length > 0 
      ? this.freeSlots.pop()! + 1  // Convert to 1-based index
      : this.idMap.length + 1;     // Append new slot
  }

  /**
   * Allocate a slot for a record
   * @param id - Record ID
   * @returns 0-based slot index
   */
  allocateSlot(id: string): number {
    const slot = this.findEmptySlot();
    const slotIndex = slot - 1; // Convert to 0-based for internal storage
    
    this.idMap[slotIndex] = id;
    this.idToSlot.set(id, slotIndex);
    
    return slotIndex;
  }

  /**
   * Deallocate a slot (mark as deleted)
   * @param id - Record ID
   * @returns True if slot was deallocated, false if not found
   */
  deallocateSlot(id: string): boolean {
    const slot = this.idToSlot.get(id);
    if (slot === undefined) {
      return false;
    }
    
    this.idMap[slot] = null;
    this.idToSlot.delete(id);
    this.freeSlots.push(slot); // Mark slot as available for reuse
    
    return true;
  }

  /**
   * Get slot index for a record ID
   * @param id - Record ID
   * @returns 0-based slot index or undefined if not found
   */
  getSlot(id: string): number | undefined {
    return this.idToSlot.get(id);
  }

  /**
   * Get record ID for a slot index
   * @param slot - 0-based slot index
   * @returns Record ID or null if slot is empty
   */
  getId(slot: number): string | null {
    return this.idMap[slot] || null;
  }

  /**
   * Load slot mappings from existing data
   * @param slotData - Slot data to load
   */
  loadSlots(slotData: SlotData[]): void {
    this.clear();
    
    for (const { slot, id } of slotData) {
      if (id === null) {
        this.idMap[slot] = null;
        this.freeSlots.push(slot);
      } else {
        this.idMap[slot] = id;
        this.idToSlot.set(id, slot);
      }
    }
  }

  /**
   * Clear all slot data
   */
  clear(): void {
    this.idMap = [];
    this.idToSlot.clear();
    this.freeSlots = [];
  }

  /**
   * Get slot statistics
   */
  getStats(): SlotStats {
    const activeSlots = this.idMap.filter(id => id).length;
    return {
      totalSlots: this.idMap.length,
      activeSlots,
      freeSlots: this.freeSlots.length,
      slotUtilization: this.idMap.length > 0 
        ? activeSlots / this.idMap.length 
        : 0
    };
  }

  /**
   * Get all active record IDs
   */
  getActiveIds(): string[] {
    return this.idMap.filter((id): id is string => id !== null);
  }

  /**
   * Check if a record ID exists
   */
  hasId(id: string): boolean {
    return this.idToSlot.has(id);
  }

  /**
   * Get the number of allocated slots
   */
  get allocatedCount(): number {
    return this.idToSlot.size;
  }

  /**
   * Get the number of free slots available for reuse
   */
  get freeCount(): number {
    return this.freeSlots.length;
  }

  /**
   * Get the total number of slots (allocated + free)
   */
  get totalCount(): number {
    return this.idMap.length;
  }
}