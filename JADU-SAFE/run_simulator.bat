@echo off
cd simulation
python sensor_simulator.py --url http://127.0.0.1:8001 %*
