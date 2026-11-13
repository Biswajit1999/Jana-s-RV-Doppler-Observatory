"""Independent multi-instrument RV information and cadence diagnostics."""
import numpy as np

def weighted_offset_projection(time, velocity, sigma, instrument):
    """Subtract weighted per-instrument offsets, not planetary signals."""
    t,y,s,inst = map(np.asarray,(time,velocity,sigma,instrument))
    if any(v.ndim != 1 or v.size != t.size for v in (y,s,inst)) or t.size < 3 or not np.all(np.isfinite(t)) or not np.all(np.isfinite(y)) or not np.all(np.isfinite(s)) or np.any(s <= 0):
        raise ValueError("invalid RV arrays")
    residual = y.astype(float).copy()
    for group in np.unique(inst):
        m = inst == group
        residual[m] -= np.average(y[m],weights=1/s[m]**2)
    return residual

def sinusoid_information(time,sigma,instrument,period):
    """Eigenvalues of sine/cosine Fisher matrix after instrument-offset profiling."""
    t,s,inst = map(np.asarray,(time,sigma,instrument))
    if t.ndim != 1 or s.shape != t.shape or inst.shape != t.shape or t.size < 4 or not np.all(np.isfinite(t)) or not np.all(np.isfinite(s)) or np.any(s <= 0) or not np.isfinite(period) or period <= 0:
        raise ValueError("invalid observations or period")
    phase = 2*np.pi*np.remainder((t-t[0])/period,1.0)
    design = np.column_stack((np.sin(phase),np.cos(phase)))
    w = 1/s**2
    for group in np.unique(inst):
        m = inst == group
        design[m] -= np.average(design[m],axis=0,weights=w[m])
    return np.linalg.eigvalsh(design.T @ (w[:,None]*design))

def phase_coverage(time,period,bins=10):
    """Fraction of phase bins containing at least one observation."""
    t = np.asarray(time,dtype=float)
    if t.ndim != 1 or not t.size or not np.all(np.isfinite(t)) or not np.isfinite(period) or period <= 0 or not isinstance(bins,int) or bins < 2:
        raise ValueError("invalid phase inputs")
    phase = np.remainder((t-t[0])/period,1.0)
    return np.unique(np.minimum((phase*bins).astype(int),bins-1)).size/bins
