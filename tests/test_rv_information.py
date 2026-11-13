"""Synthetic regression checks for multi-instrument information."""
import unittest
import numpy as np
from scripts.rv_information import weighted_offset_projection,sinusoid_information,phase_coverage

class InformationTests(unittest.TestCase):
    def test_offsets(self):
        t=np.arange(8); y=np.array([2,3,4,5,102,103,104,105]); inst=np.array([0]*4+[1]*4)
        r=weighted_offset_projection(t,y,np.ones(8),inst)
        self.assertAlmostEqual(r[:4].mean(),0)
        self.assertAlmostEqual(r[4:].mean(),0)
    def test_information(self):
        t=np.arange(40,dtype=float); s=np.ones(40); inst=np.array([0]*20+[1]*20)
        self.assertTrue(np.all(sinusoid_information(t,s,inst,8)>0))
        self.assertLess(sinusoid_information(t,s,inst,1)[0],1e-20)
    def test_phase_coverage(self):
        self.assertEqual(phase_coverage(np.arange(10),10,10),1)
        self.assertEqual(phase_coverage(np.zeros(10),10,10),.1)
    def test_invalid(self):
        with self.assertRaises(ValueError): phase_coverage([1,2],0)

if __name__ == "__main__": unittest.main()
