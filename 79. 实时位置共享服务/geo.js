// 地理空间索引 - 使用 GeoHash 实现快速附近搜索
// 简化的基于网格的空间索引

const EARTH_RADIUS = 6371000; // 米

function deg2rad(d) { return d * Math.PI / 180; }

// Haversine 距离公式（米）
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon/2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(a));
}

// GeoHash 编码（简化版，base32）
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function geohashEncode(lat, lon, precision = 7) {
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;
  let bits = 0, bit = 0, even = true;
  let hash = '';
  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) { bits = (bits << 1) | 1; lonMin = mid; }
      else { bits = bits << 1; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { bits = (bits << 1) | 1; latMin = mid; }
      else { bits = bits << 1; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[bits];
      bits = 0; bit = 0;
    }
  }
  return hash;
}

class GeoIndex {
  constructor(precision = 6) {
    this.precision = precision;  // 6 位 hash ≈ 1.2km 网格
    this.cells = new Map();      // hash -> Set(userId)
    this.locations = new Map();  // userId -> { lat, lon, hash, ts }
  }

  upsert(userId, lat, lon) {
    const old = this.locations.get(userId);
    if (old) {
      const oldCell = this.cells.get(old.hash);
      if (oldCell) {
        oldCell.delete(userId);
        if (oldCell.size === 0) this.cells.delete(old.hash);
      }
    }
    const hash = geohashEncode(lat, lon, this.precision);
    if (!this.cells.has(hash)) this.cells.set(hash, new Set());
    this.cells.get(hash).add(userId);
    this.locations.set(userId, { lat, lon, hash, ts: Date.now() });
  }

  remove(userId) {
    const loc = this.locations.get(userId);
    if (!loc) return;
    const cell = this.cells.get(loc.hash);
    if (cell) {
      cell.delete(userId);
      if (cell.size === 0) this.cells.delete(loc.hash);
    }
    this.locations.delete(userId);
  }

  // 查找半径内的用户（米）
  nearby(lat, lon, radiusMeters) {
    const results = [];
    // 简化：扫描所有 cell（生产环境应只扫附近 cell）
    for (const [userId, loc] of this.locations) {
      const dist = haversine(lat, lon, loc.lat, loc.lon);
      if (dist <= radiusMeters) {
        results.push({ userId, lat: loc.lat, lon: loc.lon, distance: Math.round(dist) });
      }
    }
    return results.sort((a, b) => a.distance - b.distance);
  }

  get(userId) { return this.locations.get(userId); }
  all() { return [...this.locations]; }
}

module.exports = { GeoIndex, haversine, geohashEncode };
