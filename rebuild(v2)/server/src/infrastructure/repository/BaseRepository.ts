export abstract class BaseRepository<
  TModel,
  TCreateInput = any,
  TUpdateInput = any,
  TWhereUniqueInput = any,
  TWhereInput = any
> {
  constructor(
    protected readonly defaultDelegate: any,
    protected readonly modelName: string
  ) {}

  /**
   * Resolves the target delegate dynamically.
   * If a transaction client (tx) is provided, it returns the model-specific client delegate.
   */
  protected getDelegate(tx?: any): any {
    if (tx && typeof tx === 'object') {
      // Prisma transactions pass a transaction client object
      const txDelegate = tx[this.modelName];
      if (txDelegate) return txDelegate;
    }
    return this.defaultDelegate;
  }

  async findById(id: string, tx?: any): Promise<TModel | null> {
    return this.getDelegate(tx).findUnique({ where: { id } });
  }

  async findUnique(where: TWhereUniqueInput, tx?: any): Promise<TModel | null> {
    return this.getDelegate(tx).findUnique({ where });
  }

  async findFirst(where: TWhereInput, tx?: any): Promise<TModel | null> {
    return this.getDelegate(tx).findFirst({ where });
  }

  async findMany(where?: TWhereInput, orderBy?: any, tx?: any): Promise<TModel[]> {
    return this.getDelegate(tx).findMany({ where, orderBy });
  }

  async create(data: TCreateInput, tx?: any): Promise<TModel> {
    return this.getDelegate(tx).create({ data });
  }

  async update(id: string, data: TUpdateInput, tx?: any): Promise<TModel> {
    return this.getDelegate(tx).update({ where: { id }, data });
  }

  async delete(id: string, tx?: any): Promise<TModel> {
    return this.getDelegate(tx).delete({ where: { id } });
  }

  async count(where?: TWhereInput, tx?: any): Promise<number> {
    return this.getDelegate(tx).count({ where });
  }
}
