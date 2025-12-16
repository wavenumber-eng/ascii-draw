/**
 * Command Pattern - Base class and concrete commands for undo/redo
 * Implements: ARCH-10, ARCH-11, ARCH-13
 */

var AsciiEditor = AsciiEditor || {};
AsciiEditor.core = AsciiEditor.core || {};

const deepClone = AsciiEditor.core.deepClone;

// Base Command class
AsciiEditor.core.Command = class Command {
  execute(state) { return state; }
  undo(state) { return state; }
  canMerge(other) { return false; }
  merge(other) { return this; }
};

// Create a new object on a page
AsciiEditor.core.CreateObjectCommand = class CreateObjectCommand extends AsciiEditor.core.Command {
  constructor(pageId, object) {
    super();
    this.pageId = pageId;
    this.object = object;
  }

  execute(state) {
    const newState = AsciiEditor.core.deepClone(state);
    const page = newState.project.pages.find(p => p.id === this.pageId);
    if (page) {
      page.objects.push(this.object);
    }
    return newState;
  }

  undo(state) {
    const newState = AsciiEditor.core.deepClone(state);
    const page = newState.project.pages.find(p => p.id === this.pageId);
    if (page) {
      page.objects = page.objects.filter(o => o.id !== this.object.id);
    }
    return newState;
  }
};

// Delete an object from a page
AsciiEditor.core.DeleteObjectCommand = class DeleteObjectCommand extends AsciiEditor.core.Command {
  constructor(pageId, object) {
    super();
    this.pageId = pageId;
    this.object = object;
  }

  execute(state) {
    const newState = AsciiEditor.core.deepClone(state);
    const page = newState.project.pages.find(p => p.id === this.pageId);
    if (page) {
      page.objects = page.objects.filter(o => o.id !== this.object.id);
    }
    return newState;
  }

  undo(state) {
    const newState = AsciiEditor.core.deepClone(state);
    const page = newState.project.pages.find(p => p.id === this.pageId);
    if (page) {
      page.objects.push(this.object);
    }
    return newState;
  }
};

// Move an object (supports merging for continuous drag)
AsciiEditor.core.MoveObjectCommand = class MoveObjectCommand extends AsciiEditor.core.Command {
  constructor(pageId, objectId, fromPos, toPos) {
    super();
    this.pageId = pageId;
    this.objectId = objectId;
    this.fromPos = fromPos;
    this.toPos = toPos;
  }

  execute(state) {
    const newState = AsciiEditor.core.deepClone(state);
    const page = newState.project.pages.find(p => p.id === this.pageId);
    if (page) {
      const obj = page.objects.find(o => o.id === this.objectId);
      if (obj) {
        obj.x = this.toPos.x;
        obj.y = this.toPos.y;
      }
    }
    return newState;
  }

  undo(state) {
    const newState = AsciiEditor.core.deepClone(state);
    const page = newState.project.pages.find(p => p.id === this.pageId);
    if (page) {
      const obj = page.objects.find(o => o.id === this.objectId);
      if (obj) {
        obj.x = this.fromPos.x;
        obj.y = this.fromPos.y;
      }
    }
    return newState;
  }

  canMerge(other) {
    return other instanceof AsciiEditor.core.MoveObjectCommand &&
           other.objectId === this.objectId &&
           other.pageId === this.pageId;
  }

  merge(other) {
    return new AsciiEditor.core.MoveObjectCommand(this.pageId, this.objectId, this.fromPos, other.toPos);
  }
};

// Modify object properties
AsciiEditor.core.ModifyObjectCommand = class ModifyObjectCommand extends AsciiEditor.core.Command {
  constructor(pageId, objectId, oldProps, newProps) {
    super();
    this.pageId = pageId;
    this.objectId = objectId;
    this.oldProps = oldProps;
    this.newProps = newProps;
  }

  execute(state) {
    const newState = AsciiEditor.core.deepClone(state);
    const page = newState.project.pages.find(p => p.id === this.pageId);
    if (page) {
      const obj = page.objects.find(o => o.id === this.objectId);
      if (obj) {
        Object.assign(obj, this.newProps);
      }
    }
    return newState;
  }

  undo(state) {
    const newState = AsciiEditor.core.deepClone(state);
    const page = newState.project.pages.find(p => p.id === this.pageId);
    if (page) {
      const obj = page.objects.find(o => o.id === this.objectId);
      if (obj) {
        Object.assign(obj, this.oldProps);
      }
    }
    return newState;
  }
};
