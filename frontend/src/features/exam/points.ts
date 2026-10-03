const scale = BigInt("10000000000");
const zero = BigInt(0), one = BigInt(1);
export function units(raw: string): bigint {
  if (!/^\d{1,20}(\.\d{1,10})?$/.test(raw)) throw new Error("Điểm cần là số dương, tối đa 20 chữ số phần nguyên và 10 chữ số thập phân.");
  const [integer, fraction = ""] = raw.split(".");
  const value = BigInt(integer) * scale + BigInt(fraction.padEnd(10, "0"));
  if (value <= zero) throw new Error("Điểm mỗi câu phải lớn hơn 0.");
  return value;
}
export function decimal(value: bigint) {
  const fraction = (value % scale).toString().padStart(10, "0").replace(/0+$/, "");
  return `${value / scale}${fraction ? `.${fraction}` : ""}`;
}
export function totalPoints(points: string[]) { return decimal(points.reduce((sum, p) => sum + units(p), zero)); }
export function distributePoints(total: string, count: number): string[] {
  if (!Number.isInteger(count) || count <= 0) throw new Error("Thêm câu hỏi trước khi chia điểm.");
  const value = units(total), size = BigInt(count), base = value / size, remainder = value % size;
  if (base === zero) throw new Error("Tổng điểm quá nhỏ để mỗi câu có điểm lớn hơn 0.");
  return Array.from({ length: count }, (_, i) => decimal(base + (BigInt(i) < remainder ? one : zero)));
}
