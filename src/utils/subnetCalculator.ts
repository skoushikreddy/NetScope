/**
 * IPv4 Subnet Calculator Utilities
 * Implements standard CIDR math, address classifications, and RFC 3021 / RFC 1918 rules.
 */

export interface SubnetDetails {
  ip: string;
  cidr: number;
  networkAddress: string;
  broadcastAddress: string;
  subnetMask: string;
  wildcardMask: string;
  totalAddresses: number;
  usableHosts: number;
  firstUsableAddress: string;
  lastUsableAddress: string;
  ipClass: 'A' | 'B' | 'C' | 'D (Multicast)' | 'E (Experimental)';
  isPrivate: boolean;
  isLoopback: boolean;
  isLinkLocal: boolean;
  binarySubnetMask: string;
  binaryIp: string;
  edgeCaseNote?: string;
}

/**
 * Converts dotted-decimal IPv4 string to 32-bit unsigned integer
 */
export function ipToInt(ip: string): number {
  const octets = ip.trim().split('.');
  if (octets.length !== 4) {
    throw new Error(`Invalid IPv4 address format: "${ip}"`);
  }
  let result = 0;
  for (const octet of octets) {
    if (!/^\d+$/.test(octet)) {
      throw new Error(`Invalid IPv4 octet: "${octet}"`);
    }
    const num = parseInt(octet, 10);
    if (num < 0 || num > 255) {
      throw new Error(`IPv4 octet out of range (0-255): "${octet}"`);
    }
    result = (result << 8) | num;
  }
  return result >>> 0;
}

/**
 * Converts 32-bit unsigned integer to dotted-decimal IPv4 string
 */
export function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

/**
 * Converts 32-bit integer to 8-bit spaced binary string
 */
export function intToBinary(int: number): string {
  const binary = (int >>> 0).toString(2).padStart(32, '0');
  return `${binary.slice(0, 8)}.${binary.slice(8, 16)}.${binary.slice(16, 24)}.${binary.slice(24, 32)}`;
}

/**
 * Checks if an IP falls within standard private IPv4 ranges (RFC 1918)
 */
export function isPrivateIpv4(ipInt: number): boolean {
  // 10.0.0.0/8: 10.0.0.0 to 10.255.255.255 (0x0A000000 - 0x0AFFFFFF)
  if ((ipInt & 0xff000000) >>> 0 === 0x0a000000) return true;
  // 172.16.0.0/12: 172.16.0.0 to 172.31.255.255 (0xAC100000 - 0xAC1FFFFF)
  if ((ipInt & 0xfff00000) >>> 0 === 0xac100000) return true;
  // 192.168.0.0/16: 192.168.0.0 to 192.168.255.255 (0xC0A80000 - 0xC0A8FFFF)
  if ((ipInt & 0xffff0000) >>> 0 === 0xc0a80000) return true;
  return false;
}

export function isLoopbackIpv4(ipInt: number): boolean {
  // 127.0.0.0/8: 127.0.0.0 to 127.255.255.255 (0x7F000000 - 0x7FFFFFFF)
  return ((ipInt & 0xff000000) >>> 0) === 0x7f000000;
}

export function isLinkLocalIpv4(ipInt: number): boolean {
  // 169.254.0.0/16: 169.254.0.0 to 169.254.255.255 (0xA9FE0000 - 0xA9FEFFFF)
  return ((ipInt & 0xffff0000) >>> 0) === 0xa9fe0000;
}

/**
 * Determines legacy classful category based on first octet
 */
export function getIpClass(firstOctet: number): SubnetDetails['ipClass'] {
  if (firstOctet >= 1 && firstOctet <= 126) return 'A';
  if (firstOctet >= 128 && firstOctet <= 191) return 'B';
  if (firstOctet >= 192 && firstOctet <= 223) return 'C';
  if (firstOctet >= 224 && firstOctet <= 239) return 'D (Multicast)';
  return 'E (Experimental)';
}

/**
 * Calculates comprehensive subnet details for an input string like "192.168.1.50/24"
 */
export function calculateSubnet(input: string): SubnetDetails {
  const parts = input.trim().split('/');
  if (parts.length > 2) {
    throw new Error('Invalid CIDR format. Expected format like "192.168.1.0/24"');
  }

  const ipStr = parts[0].trim();
  const cidrStr = parts[1]?.trim() ?? '24';

  if (!/^\d+$/.test(cidrStr)) {
    throw new Error(`CIDR prefix must be a number between 0 and 32, got "${cidrStr}"`);
  }

  const cidr = parseInt(cidrStr, 10);
  if (cidr < 0 || cidr > 32) {
    throw new Error(`CIDR prefix must be between /0 and /32, got "/${cidr}"`);
  }

  const ip = ipToInt(ipStr);
  const firstOctet = (ip >>> 24) & 255;

  // Mask calculation (handle 32-bit shift edge case in JS)
  const mask = cidr === 0 ? 0 : ((0xffffffff << (32 - cidr)) >>> 0);
  const wildcard = (~mask) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;

  const totalAddresses = cidr === 0 ? 4294967296 : Math.pow(2, 32 - cidr);

  let usableHosts: number;
  let firstUsable: number;
  let lastUsable: number;
  let edgeCaseNote: string | undefined;

  if (cidr === 32) {
    // Single host route (RFC 1122 / RFC 3021)
    usableHosts = 1;
    firstUsable = network;
    lastUsable = network;
    edgeCaseNote = '/32 represents a single host route. The host, network, and broadcast are the same single address.';
  } else if (cidr === 31) {
    // RFC 3021: Using 31-Bit Prefixes on IPv4 Point-to-Point Links
    usableHosts = 2;
    firstUsable = network;
    lastUsable = broadcast;
    edgeCaseNote = 'RFC 3021 allows both addresses in a /31 prefix to be assigned to point-to-point router links without reserved network or broadcast addresses.';
  } else if (cidr === 0) {
    usableHosts = 4294967294;
    firstUsable = 1;
    lastUsable = 0xfffffffe;
    edgeCaseNote = '/0 represents the default route matching the entire IPv4 Internet address space.';
  } else {
    usableHosts = totalAddresses - 2;
    firstUsable = network + 1;
    lastUsable = broadcast - 1;
  }

  return {
    ip: intToIp(ip),
    cidr,
    networkAddress: intToIp(network),
    broadcastAddress: intToIp(broadcast),
    subnetMask: intToIp(mask),
    wildcardMask: intToIp(wildcard),
    totalAddresses,
    usableHosts,
    firstUsableAddress: intToIp(firstUsable),
    lastUsableAddress: intToIp(lastUsable),
    ipClass: getIpClass(firstOctet),
    isPrivate: isPrivateIpv4(ip),
    isLoopback: isLoopbackIpv4(ip),
    isLinkLocal: isLinkLocalIpv4(ip),
    binarySubnetMask: intToBinary(mask),
    binaryIp: intToBinary(ip),
    edgeCaseNote,
  };
}

/**
 * Generates an array of host IP strings in a subnet, with an optional safety limit.
 */
export function getSubnetHostIps(cidrInput: string, maxHosts: number = 256): string[] {
  const subnet = calculateSubnet(cidrInput);
  const ips: string[] = [];

  if (subnet.cidr === 32) {
    return [subnet.networkAddress];
  }

  if (subnet.cidr === 31) {
    return [subnet.networkAddress, subnet.broadcastAddress];
  }

  const startInt = ipToInt(subnet.firstUsableAddress);
  const endInt = ipToInt(subnet.lastUsableAddress);

  for (let current = startInt; current <= endInt; current++) {
    if (ips.length >= maxHosts) {
      break;
    }
    ips.push(intToIp(current));
  }

  return ips;
}
