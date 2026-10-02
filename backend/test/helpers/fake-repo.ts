/** Minimal in-memory stand-in for a TypeORM repository (equality `where`, no relations). */
export class FakeRepo<T extends Record<string, any>> {
  rows: T[] = [];
  private seq = 0;
  private matches(row: T, where: Record<string, any> = {}) {
    return Object.entries(where).every(([k, v]) => row[k] === v);
  }
  async findOne({ where }: { where: Record<string, any>; order?: any }) {
    const found = [...this.rows].reverse().find((r) => this.matches(r, where));
    return found ? { ...found } : null;
  }
  async find({ where = {}, take }: { where?: Record<string, any>; order?: any; take?: number } = {}) {
    const rows = [...this.rows].reverse().filter((r) => this.matches(r, where)).map((r) => ({ ...r }));
    return take ? rows.slice(0, take) : rows;
  }
  async count({ where = {} }: { where?: Record<string, any> } = {}) {
    return this.rows.filter((r) => this.matches(r, where)).length;
  }
  async save(entity: any) {
    const row = { id: `id-${++this.seq}`, createdAt: new Date(), updatedAt: new Date(), ...entity };
    this.rows.push(row);
    return { ...row };
  }
  async delete(where: Record<string, any>) {
    this.rows = this.rows.filter((r) => !this.matches(r, where));
  }
  async update(where: Record<string, any>, patch: Record<string, any>) {
    this.rows.filter((r) => this.matches(r, where)).forEach((r) => Object.assign(r, patch));
  }
}
