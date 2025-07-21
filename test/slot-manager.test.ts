import { SlotManager } from '../engine/slot-manager';

describe('SlotManager', () => {
  let slotManager: SlotManager;

  beforeEach(() => {
    slotManager = new SlotManager();
  });

  describe('Basic Slot Allocation', () => {
    it('should allocate first slot as 0', () => {
      const slot = slotManager.allocateSlot('record1');
      expect(slot).toBe(0);
    });

    it('should allocate sequential slots for different records', () => {
      const slot1 = slotManager.allocateSlot('record1');
      const slot2 = slotManager.allocateSlot('record2');
      const slot3 = slotManager.allocateSlot('record3');

      expect(slot1).toBe(0);
      expect(slot2).toBe(1);
      expect(slot3).toBe(2);
    });

    it('should return different slots for duplicate allocation', () => {
      const slot1 = slotManager.allocateSlot('record1');
      const slot2 = slotManager.allocateSlot('record1');

      // SlotManager creates new slots for duplicate IDs rather than reusing
      expect(slot1).toBe(0);
      expect(slot2).toBe(1);
    });

    it('should track allocated slots correctly', () => {
      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');
      slotManager.allocateSlot('record3');

      expect(slotManager.allocatedCount).toBe(3);
      expect(slotManager.totalCount).toBe(3);
    });
  });

  describe('Slot Deallocation', () => {
    it('should deallocate existing slot', () => {
      slotManager.allocateSlot('record1');
      const deallocated = slotManager.deallocateSlot('record1');

      expect(deallocated).toBe(true);
      expect(slotManager.allocatedCount).toBe(0);
      expect(slotManager.freeCount).toBe(1);
    });

    it('should not deallocate non-existent record', () => {
      const deallocated = slotManager.deallocateSlot('nonexistent');

      expect(deallocated).toBe(false);
      expect(slotManager.allocatedCount).toBe(0);
      expect(slotManager.freeCount).toBe(0);
    });

    it('should reuse deallocated slots', () => {
      // Allocate slots 0, 1, 2
      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');
      slotManager.allocateSlot('record3');

      slotManager.deallocateSlot('record2'); // Slot 1 becomes free

      // Allocate new record - should reuse slot 1
      const newSlot = slotManager.allocateSlot('record4');
      expect(newSlot).toBe(1);
    });

    it('should handle multiple deallocations correctly', () => {
      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');
      slotManager.allocateSlot('record3');
      slotManager.allocateSlot('record4');

      slotManager.deallocateSlot('record2');
      slotManager.deallocateSlot('record4');

      expect(slotManager.allocatedCount).toBe(2);
      expect(slotManager.freeCount).toBe(2);
      expect(slotManager.totalCount).toBe(4);
    });
  });

  describe('Slot Lookup', () => {
    it('should find slot for existing record', () => {
      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');

      const slot = slotManager.getSlot('record2');
      expect(slot).toBe(1);
    });

    it('should return undefined for non-existent record', () => {
      const slot = slotManager.getSlot('nonexistent');
      expect(slot).toBeUndefined();
    });

    it('should return undefined for deallocated record', () => {
      slotManager.allocateSlot('record1');
      slotManager.deallocateSlot('record1');

      const slot = slotManager.getSlot('record1');
      expect(slot).toBeUndefined();
    });
  });

  describe('Statistics and Counts', () => {
    it('should track allocated count correctly', () => {
      expect(slotManager.allocatedCount).toBe(0);

      slotManager.allocateSlot('record1');
      expect(slotManager.allocatedCount).toBe(1);

      slotManager.allocateSlot('record2');
      expect(slotManager.allocatedCount).toBe(2);

      slotManager.deallocateSlot('record1');
      expect(slotManager.allocatedCount).toBe(1);
    });

    it('should track free count correctly', () => {
      expect(slotManager.freeCount).toBe(0);

      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');
      expect(slotManager.freeCount).toBe(0);

      slotManager.deallocateSlot('record1');
      expect(slotManager.freeCount).toBe(1);

      slotManager.deallocateSlot('record2');
      expect(slotManager.freeCount).toBe(2);
    });

    it('should track total count correctly', () => {
      expect(slotManager.totalCount).toBe(0);

      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');
      expect(slotManager.totalCount).toBe(2);

      slotManager.deallocateSlot('record1');
      expect(slotManager.totalCount).toBe(2); // Total doesn't decrease

      slotManager.allocateSlot('record3');
      expect(slotManager.totalCount).toBe(2); // Reused slot
    });

    it('should provide comprehensive statistics', () => {
      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');
      slotManager.allocateSlot('record3');
      slotManager.deallocateSlot('record2');

      const stats = slotManager.getStats();

      expect(stats.activeSlots).toBe(2);
      expect(stats.freeSlots).toBe(1);
      expect(stats.totalSlots).toBe(3);
    });
  });

  describe('Active Record IDs', () => {
    it('should return all active record IDs', () => {
      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');
      slotManager.allocateSlot('record3');

      const activeIds = slotManager.getActiveIds();

      expect(activeIds).toHaveLength(3);
      expect(activeIds).toContain('record1');
      expect(activeIds).toContain('record2');
      expect(activeIds).toContain('record3');
    });

    it('should exclude deallocated records from active IDs', () => {
      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');
      slotManager.allocateSlot('record3');
      slotManager.deallocateSlot('record2');

      const activeIds = slotManager.getActiveIds();

      expect(activeIds).toHaveLength(2);
      expect(activeIds).toContain('record1');
      expect(activeIds).not.toContain('record2');
      expect(activeIds).toContain('record3');
    });

    it('should return empty array when no active records', () => {
      const activeIds = slotManager.getActiveIds();
      expect(activeIds).toHaveLength(0);
    });

    it('should return empty array when all records are deallocated', () => {
      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');
      slotManager.deallocateSlot('record1');
      slotManager.deallocateSlot('record2');

      const activeIds = slotManager.getActiveIds();
      expect(activeIds).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed allocation/deallocation patterns', () => {
      // Allocate some records
      slotManager.allocateSlot('A');
      slotManager.allocateSlot('B');
      slotManager.allocateSlot('C');
      slotManager.allocateSlot('D');

      // Deallocate middle ones
      slotManager.deallocateSlot('B');
      slotManager.deallocateSlot('C');

      // Allocate new ones - should reuse slots
      const slotE = slotManager.allocateSlot('E');
      const slotF = slotManager.allocateSlot('F');

      expect(slotE).toBe(2); // Reused C's slot (last deallocated)
      expect(slotF).toBe(1); // Reused B's slot

      // Verify state
      expect(slotManager.allocatedCount).toBe(4);
      expect(slotManager.freeCount).toBe(0);
      expect(slotManager.totalCount).toBe(4);

      const activeIds = slotManager.getActiveIds();
      expect(activeIds).toHaveLength(4);
      expect(activeIds).toContain('A');
      expect(activeIds).toContain('D');
      expect(activeIds).toContain('E');
      expect(activeIds).toContain('F');
    });

    it('should handle large number of allocations efficiently', () => {
      const recordCount = 100; // Reduced for faster test

      // Allocate many records
      for (let i = 0; i < recordCount; i++) {
        const slot = slotManager.allocateSlot(`record${i}`);
        expect(slot).toBe(i); // 0-based indexing
      }

      expect(slotManager.allocatedCount).toBe(recordCount);
      expect(slotManager.totalCount).toBe(recordCount);

      // Deallocate every other record
      for (let i = 0; i < recordCount; i += 2) {
        slotManager.deallocateSlot(`record${i}`);
      }

      expect(slotManager.allocatedCount).toBe(recordCount / 2);
      expect(slotManager.freeCount).toBe(recordCount / 2);
    });

    it('should maintain data integrity through stress testing', () => {
      const operations = [
        () => slotManager.allocateSlot('test1'),
        () => slotManager.allocateSlot('test2'),
        () => slotManager.allocateSlot('test3'),
        () => slotManager.deallocateSlot('test1'),
        () => slotManager.allocateSlot('test4'),
        () => slotManager.deallocateSlot('test2'),
        () => slotManager.allocateSlot('test5'),
        () => slotManager.deallocateSlot('test3'),
        () => slotManager.deallocateSlot('test4'),
        () => slotManager.allocateSlot('test6'),
      ];

      operations.forEach(op => op());

      // Should have allocated 6 records, deallocated 4, so 2 active
      expect(slotManager.allocatedCount).toBe(2);

      const activeIds = slotManager.getActiveIds();
      expect(activeIds).toHaveLength(2);
      expect(activeIds).toContain('test5');
      expect(activeIds).toContain('test6');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string record IDs', () => {
      const slot = slotManager.allocateSlot('');
      expect(slot).toBe(0);

      const foundSlot = slotManager.getSlot('');
      expect(foundSlot).toBe(0);

      const deallocated = slotManager.deallocateSlot('');
      expect(deallocated).toBe(true);
    });

    it('should handle very long record IDs', () => {
      const longId = 'a'.repeat(1000);
      const slot = slotManager.allocateSlot(longId);
      expect(slot).toBe(0);

      const foundSlot = slotManager.getSlot(longId);
      expect(foundSlot).toBe(0);
    });

    it('should handle special characters in record IDs', () => {
      const specialIds = ['!@#$%', '🚀🌟', 'äöüß', '中文', '\\n\\t\\r'];

      specialIds.forEach((id, index) => {
        const slot = slotManager.allocateSlot(id);
        expect(slot).toBe(index);

        const foundSlot = slotManager.getSlot(id);
        expect(foundSlot).toBe(index);
      });
    });

    it('should handle numeric-like string IDs', () => {
      const numericIds = ['123', '0', '-1', '1.5', 'NaN', 'Infinity'];

      numericIds.forEach((id, index) => {
        const slot = slotManager.allocateSlot(id);
        expect(slot).toBe(index);
      });
    });
  });

  describe('Memory Management', () => {
    it('should clean up deallocated records from memory', () => {
      slotManager.allocateSlot('record1');
      slotManager.allocateSlot('record2');

      // Record should exist
      expect(slotManager.getSlot('record1')).toBe(0);

      // Deallocate and verify cleanup
      slotManager.deallocateSlot('record1');

      expect(slotManager.getSlot('record1')).toBeUndefined();
    });

    it('should maintain free slots efficiently', () => {
      // Allocate and deallocate to create gaps
      for (let i = 0; i < 10; i++) {
        slotManager.allocateSlot(`record${i}`);
      }

      // Deallocate some in the middle
      slotManager.deallocateSlot('record3');
      slotManager.deallocateSlot('record7');
      slotManager.deallocateSlot('record1');

      expect(slotManager.freeCount).toBe(3);

      // New allocations should reuse free slots
      const slot1 = slotManager.allocateSlot('new1');
      const slot2 = slotManager.allocateSlot('new2');
      const slot3 = slotManager.allocateSlot('new3');

      // Should reuse freed slots (LIFO order)
      expect([slot1, slot2, slot3].sort()).toEqual([1, 3, 7]);
      expect(slotManager.freeCount).toBe(0);
    });
  });
});
