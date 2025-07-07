/**
 * SlotManager - Handles slot allocation, tracking, and reuse
 */
export class SlotManager {
  constructor() {
    this.idMap = [];           // Array mapping slot index to record ID
    this.idToSlot = new Map(); // Reverse lookup: id -> slot index  
    this.freeSlots = [];       // Stack of available slots for reuse
  }

  /**
   * Find an empty slot for a new record
   * @returns {number} 1-based slot index
   */
  findEmptySlot() {
    // Reuse a deleted slot if available, otherwise append new slot
    return this.freeSlots.length > 0 
      ? this.freeSlots.pop() + 1  // Convert to 1-based index
      : this.idMap.length + 1;    // Append new slot
  }

  /**
   * Allocate a slot for a record
   * @param {string} id - Record ID
   * @returns {number} 0-based slot index
   */
  allocateSlot(id) {
    const slot = this.findEmptySlot();
    const slotIndex = slot - 1; // Convert to 0-based for internal storage
    
    this.idMap[slotIndex] = id;
    this.idToSlot.set(id, slotIndex);
    
    return slotIndex;
  }

  /**
   * Deallocate a slot (mark as deleted)
   * @param {string} id - Record ID
   * @returns {boolean} True if slot was deallocated, false if not found
   */
  deallocateSlot(id) {
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
   * @param {string} id - Record ID
   * @returns {number|undefined} 0-based slot index or undefined if not found
   */
  getSlot(id) {
    return this.idToSlot.get(id);
  }

  /**
   * Get record ID for a slot index
   * @param {number} slot - 0-based slot index
   * @returns {string|null} Record ID or null if slot is empty
   */
  getId(slot) {
    return this.idMap[slot] || null;
  }

  /**
   * Load slot mappings from existing data
   * @param {Array<{slot: number, id: string|null}>} slotData - Slot data to load
   */
  loadSlots(slotData) {
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
  clear() {
    this.idMap = [];
    this.idToSlot.clear();
    this.freeSlots = [];
  }

  /**
   * Get slot statistics
   * @returns {object} Slot statistics
   */
  getStats() {
    return {
      totalSlots: this.idMap.length,
      activeSlots: this.idMap.filter(id => id).length,
      freeSlots: this.freeSlots.length,
      slotUtilization: this.idMap.length > 0 
        ? this.idMap.filter(id => id).length / this.idMap.length 
        : 0
    };
  }

  /**
   * Get all active record IDs
   * @returns {Array<string>} Array of active record IDs
   */
  getActiveIds() {
    return this.idMap.filter(id => id);
  }
}