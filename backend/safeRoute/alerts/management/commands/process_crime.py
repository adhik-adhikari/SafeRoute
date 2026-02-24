import os
import json
from django.core.management.base import BaseCommand
from alerts.chatgpt_cleaner import get_text_from_file, get_text_from_url, clean_and_extract

class Command(BaseCommand):
    help = "Process a crime report from file or url using chatgpt for data cleaning and extraction."
    
    def add_arguments(self, parser):
        parser.add_argument('source', type=str, help="Path to a file or URL of the crime report")
        parser.add_argument('--url', action='store_true', help="Specify if the source is a URL")
        
    def handle(self, *args, **options):
        source = options['source']
        is_url = options.get('url', False)
        
        if is_url:
            try:
                text = get_text_from_url(source)
            except Exception as e:
                self.stderr.write(f"Error fetching URL: {e}")
                return
        else:
            if not os.path.exists(source):
                self.stderr.write(f"Error: File '{source}' does not exist.")
                return
            
            try:
                with open(source, "rb") as f:
                    text = get_text_from_file(f)
            except Exception as e:
                self.stderr.write(f"Error reading file: {e}")
                return 
        
        extracted_data = clean_and_extract(text)
        output_json = json.dumps(extracted_data, indent=2)
        
        self.stdout.write("Extracted data: ")
        self.stdout.write(output_json) 