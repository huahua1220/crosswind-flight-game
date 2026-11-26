// flight.js — the aircraft: state, dynamics, ground handling, fuel and damage.
// Arcade-real hybrid: real energy trading (climb bleeds speed, dive gains),
// banked coordinated turns, a true stall, and a landing grade.

import { FLIGHT, LANDING, WORLD, RUNWAY } from './config.js';

export function createAircraft() {
  return {
    x: RUNWAY.x,
    y: RUNWAY.alt + FLIGHT.gearClearance,
    z: RUNWAY.z - RUNWAY.length / 2 + 40, // holding short, facing north
    heading: (RUNWAY.heading * Math.PI) / 180,
    pitch: 0,
    roll: 0,
    v: 0,
    vs: 0,                // vertical speed, for instruments
    throttle: 0,
    flaps: 0,             // 0 / 0.5 / 1
    fuel: FLIGHT.fuelStart,
    damage: 0,
    brake: false,
    onGround: true,
    crashed: false,
    landed: false,
    stalled: false,
    engineDead: false,
    propAngle: 0,
    rpm: 0,
    groundRoll: 0,
    smoke: 0,             // engine smoke amount from damage
  };
}

// Current wind: varies per mission seed; gentle by default.
export function windFor(seed) {
  const a = ((seed * 2654435761) >>> 0) / 4294967296;
  return { dir: a * Math.PI * 2, speed: 4 + a * 7 }; // m/s
}

export function updateAircraft(a, input, dt, world, wind) {
  const F = FLIGHT;
  if (a.crashed) {
    // Wreck settles into the terrain.
    a.v = Math.max(0, a.v - 40 * dt);
    a.propAngle += a.rpm * dt * 0.2;
    a.rpm = Math.max(0, a.rpm - 3 * dt);
    return;
  }

  const throttle = a.engineDead ? 0 : a.throttle;
  a.rpm += ((0.22 + throttle * 0.78) * (a.engineDead ? 0 : 1) - a.rpm) * Math.min(1, dt * 2.4);
  a.propAngle += a.rpm * dt * 60;

  // --- speed / energy ---
  const drag = F.dragK * a.v * a.v * (1 + a.flaps * 0.9) + (a.onGround ? 0 : 0) + a.damage * 0.004 * a.v;
  const thrust = F.idleAccel + (F.thrustAccel - F.idleAccel) * throttle;
  const climbCost = -F.gravity * Math.sin(a.pitch);
  const brakeDrag = a.onGround && a.brake ? 6.5 : 0;
  const rollingDrag = a.onGround ? 0.6 : 0;
  a.v += (thrust - drag - brakeDrag - rollingDrag + (a.onGround ? 0 : climbCost)) * dt;
  a.v = Math.max(0, Math.min(F.vMax, a.v));

  // --- control surfaces get mushy at low speed, crisp when fast ---
  const authority = Math.min(1, a.v / 38) * (a.engineDead ? 0.85 : 1);
  const stallSpeed = a.flaps > 0.4 ? F.vStallFlaps : F.vStall;
  a.stalled = !a.onGround && a.v < stallSpeed;

  const pitchIn = input.pitch; // -1 (nose down) .. +1 (nose up)
  const rollIn = input.roll;
  const yawIn = input.yaw;

  if (a.onGround) {
    // ground roll: nose steers with rudder/roll keys once rolling
    const steer = (yawIn + rollIn * 0.4) * Math.min(1, a.v / 12);
    a.heading += steer * 0.9 * dt;
    a.pitch += (0 - a.pitch) * dt * 3;
    a.roll += (0 - a.roll) * dt * 3;
    // rotation: pull back above rotate speed to lift off
    if (a.v > F.vRotate && pitchIn > 0.3) {
      a.pitch += pitchIn * 0.8 * dt;
      if (a.pitch > 0.1) a.onGround = false;
    }
    a.vs = 0;
  } else {
    a.pitch += pitchIn * F.pitchRate * authority * dt;
    a.roll += rollIn * F.rollRate * authority * dt;
    a.roll += -a.roll * 0.35 * dt; // gentle spiral stability
    if (a.stalled) {
      // stall break: nose drops, wings rock, big sink
      a.pitch += (-0.5 - a.pitch) * dt * 1.6;
      a.roll += Math.sin(a.propAngle * 0.4) * 0.9 * dt;
    }
    // coordinated turn: bank drives heading; rudder adds a little
    const bank = Math.sin(a.roll);
    a.heading += (-bank * F.gravity * 1.5) / Math.max(30, a.v) * dt * -1;
    a.heading += yawIn * F.yawRate * authority * dt;
    // lift deficit at stall -> extra sink handled via pitch energy already;
    // wings level the nose naturally wants to drop at very low speed
    if (a.v < stallSpeed * 0.85) a.pitch += -0.25 * dt;
  }

  a.pitch = Math.max(F.pitchMin, Math.min(F.pitchMax, a.pitch));
  a.roll = Math.max(-1.4, Math.min(1.4, a.roll));
  a.heading = wrapAngle(a.heading);

  // --- integrate position ---
  const dx = Math.sin(a.heading) * Math.cos(a.pitch);
  const dz = Math.cos(a.heading) * Math.cos(a.pitch);
  const dy = Math.sin(a.pitch);
  const prevY = a.y;
  const windK = a.onGround ? 0 : 1; // wind only matters airborne
  a.x += (dx * a.v + Math.sin(wind.dir) * wind.speed * windK) * dt;
  a.z += (dz * a.v + Math.cos(wind.dir) * wind.speed * windK) * dt;
  a.y += (a.onGround ? 0 : dy * a.v * dt);
  a.vs = (a.y - prevY) / dt;

  // --- fuel & engine ---
  a.fuel = Math.max(0, a.fuel - (F.fuelBurnIdle + F.fuelBurnFull * throttle * throttle) * dt);
  if (a.fuel <= 0) a.engineDead = true;
  a.smoke = a.damage > 55 ? 1 : a.damage > 30 ? 0.5 : 0;

  // --- terrain contact ---
  const ground = world.heightAt(a.x, a.z);
  const wheels = a.y - F.gearClearance;
  if (wheels <= ground) {
    const onRunway = world.runwayDist(a.x, a.z) <= 0;
    const sink = a.vs;
    const rollDeg = Math.abs((a.roll * 180) / Math.PI);
    if (!a.onGround) {
      // arriving from the air: grade the touchdown
      if (sink < LANDING.maxSinkCrash || rollDeg > 40 || a.v > 95 || (!onRunway && sink < LANDING.maxSinkHard)) {
        crash(a, world);
      } else if (!onRunway && a.v > LANDING.maxSpeed) {
        crash(a, world);
      } else {
        const hard = sink < LANDING.maxSinkHard || rollDeg > LANDING.maxRollDeg;
        if (hard) a.damage += 12 + (-sink - 3) * 8;
        a.onGround = true;
        a.touched = true;
        a.touchSink = sink;
        a.touchRunway = onRunway;
        a.y = ground + F.gearClearance;
        a.pitch = Math.min(a.pitch, 0.04);
      }
    }
    if (!a.crashed) {
      a.y = ground + F.gearClearance;
      if (!onRunway && a.v > 40) {
        // rough terrain chews the gear — survivable if you slow down fast
        a.damage += dt * a.v * 0.35;
        if (a.damage >= 100) crash(a, world);
      }
    }
  } else if (a.onGround) {
    a.onGround = false; // rolled off an edge or bounced
  }

  if (a.damage >= 100 && !a.crashed) crash(a, world);
}

function crash(a, world) {
  a.crashed = true;
  a.onGround = true;
  a.y = world.heightAt(a.x, a.z) + FLIGHT.gearClearance;
  a.damage = Math.min(100, Math.max(a.damage, 70));
  a.v *= 0.25;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function headingDeg(a) {
  return ((a.heading * 180) / Math.PI + 360) % 360;
}

export function resetOnRunway(a) {
  const fresh = createAircraft();
  Object.assign(a, fresh);
}
