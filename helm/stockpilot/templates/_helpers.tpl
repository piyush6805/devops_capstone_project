{{- define "stockpilot.name" -}}
{{- .Release.Name | trunc 40 | trimSuffix "-" -}}
{{- end -}}
