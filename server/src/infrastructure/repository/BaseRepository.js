export class BaseRepository {
  constructor(defaultDelegate, modelName) {
    this.defaultDelegate = defaultDelegate;
    this.modelName = modelName;
  }

  /**
   * Resolves the target delegate dynamically.
   * If a transaction client (tx) is provided, it returns the model-specific client delegate.
   */
  getDelegate(tx) {
    if (tx && typeof tx === "object") {
      // Prisma transactions pass a transaction client object
      const txDelegate = tx[this.modelName];
      if (txDelegate) return txDelegate;
    }
    return this.defaultDelegate;
  }

  async findById(id, tx) {
    return this.getDelegate(tx).findUnique({ where: { id } });
  }

  async findUnique(where, tx) {
    return this.getDelegate(tx).findUnique({ where });
  }

  async findFirst(where, tx) {
    return this.getDelegate(tx).findFirst({ where });
  }

  async findMany(where, orderBy, tx) {
    return this.getDelegate(tx).findMany({ where, orderBy });
  }

  async create(data, tx) {
    return this.getDelegate(tx).create({ data });
  }

  async update(id, data, tx) {
    return this.getDelegate(tx).update({ where: { id }, data });
  }

  async delete(id, tx) {
    return this.getDelegate(tx).delete({ where: { id } });
  }

  async count(where, tx) {
    return this.getDelegate(tx).count({ where });
  }
}
