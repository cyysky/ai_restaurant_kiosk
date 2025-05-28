from transformers import VitsModel, AutoTokenizer
import torch
import scipy.io.wavfile
import numpy as np

model = VitsModel.from_pretrained("facebook/mms-tts-zlm")
tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-zlm")
text = "apa itu musik techno?"
inputs = tokenizer(text, return_tensors="pt")

with torch.no_grad():
    output = model(**inputs).waveform

# Convert to numpy and squeeze to remove batch dimension
audio_data = output.squeeze().cpu().numpy()

scipy.io.wavfile.write("techno.wav", rate=model.config.sampling_rate, data=audio_data)