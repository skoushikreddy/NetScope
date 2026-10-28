import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSubnet,
  ipToInt,
  intToIp,
  isPrivateIpv4,
  getSubnetHostIps,
} from './subnetCalculator';

test('ipToInt and intToIp conversions work round-trip', () => {
  const ip = '192.168.1.100';
  const num = ipToInt(ip);
  assert.equal(intToIp(num), ip);

  assert.equal(intToIp(0), '0.0.0.0');
  assert.equal(intToIp(0xffffffff), '255.255.255.255');
});

test('calculateSubnet handles standard /24 subnet', () => {
  const result = calculateSubnet('192.168.1.50/24');
  assert.equal(result.networkAddress, '192.168.1.0');
  assert.equal(result.broadcastAddress, '192.168.1.255');
  assert.equal(result.subnetMask, '255.255.255.0');
  assert.equal(result.wildcardMask, '0.0.0.255');
  assert.equal(result.totalAddresses, 256);
  assert.equal(result.usableHosts, 254);
  assert.equal(result.firstUsableAddress, '192.168.1.1');
  assert.equal(result.lastUsableAddress, '192.168.1.254');
  assert.equal(result.ipClass, 'C');
  assert.equal(result.isPrivate, true);
});

test('calculateSubnet handles /16 Class B private subnet', () => {
  const result = calculateSubnet('172.16.5.10/16');
  assert.equal(result.networkAddress, '172.16.0.0');
  assert.equal(result.broadcastAddress, '172.16.255.255');
  assert.equal(result.subnetMask, '255.255.0.0');
  assert.equal(result.totalAddresses, 65536);
  assert.equal(result.usableHosts, 65534);
  assert.equal(result.ipClass, 'B');
  assert.equal(result.isPrivate, true);
});

test('calculateSubnet handles edge case /31 point-to-point (RFC 3021)', () => {
  const result = calculateSubnet('10.0.0.4/31');
  assert.equal(result.networkAddress, '10.0.0.4');
  assert.equal(result.broadcastAddress, '10.0.0.5');
  assert.equal(result.subnetMask, '255.255.255.254');
  assert.equal(result.totalAddresses, 2);
  assert.equal(result.usableHosts, 2);
  assert.equal(result.firstUsableAddress, '10.0.0.4');
  assert.equal(result.lastUsableAddress, '10.0.0.5');
  assert.ok(result.edgeCaseNote?.includes('RFC 3021'));
});

test('calculateSubnet handles edge case /32 single host', () => {
  const result = calculateSubnet('10.0.0.1/32');
  assert.equal(result.networkAddress, '10.0.0.1');
  assert.equal(result.broadcastAddress, '10.0.0.1');
  assert.equal(result.subnetMask, '255.255.255.255');
  assert.equal(result.totalAddresses, 1);
  assert.equal(result.usableHosts, 1);
  assert.equal(result.firstUsableAddress, '10.0.0.1');
  assert.equal(result.lastUsableAddress, '10.0.0.1');
  assert.ok(result.edgeCaseNote?.includes('/32'));
});

test('isPrivateIpv4 correctly categorizes ranges', () => {
  assert.equal(isPrivateIpv4(ipToInt('10.0.1.5')), true);
  assert.equal(isPrivateIpv4(ipToInt('172.20.10.1')), true);
  assert.equal(isPrivateIpv4(ipToInt('192.168.1.1')), true);
  // Public addresses
  assert.equal(isPrivateIpv4(ipToInt('8.8.8.8')), false);
  assert.equal(isPrivateIpv4(ipToInt('1.1.1.1')), false);
  assert.equal(isPrivateIpv4(ipToInt('142.250.190.46')), false);
});

test('getSubnetHostIps enumerates hosts correctly', () => {
  const hosts = getSubnetHostIps('192.168.1.0/30');
  assert.deepEqual(hosts, ['192.168.1.1', '192.168.1.2']);

  const p2pHosts = getSubnetHostIps('10.0.0.2/31');
  assert.deepEqual(p2pHosts, ['10.0.0.2', '10.0.0.3']);

  const singleHost = getSubnetHostIps('192.168.1.50/32');
  assert.deepEqual(singleHost, ['192.168.1.50']);
});

test('calculateSubnet throws on invalid input', () => {
  assert.throws(() => calculateSubnet('invalid-ip/24'));
  assert.throws(() => calculateSubnet('192.168.1.1/35'));
  assert.throws(() => calculateSubnet('192.168.1.1/-1'));
  assert.throws(() => calculateSubnet('300.1.1.1/24'));
});
