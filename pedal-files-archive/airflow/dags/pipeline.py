"""
PEDAL (Pipeline for Enhanced Domain Artifact Logic) main DAG
This DAG orchestrates the multi-stage artifact generation pipeline for domain-driven design workflows
with manual approval gates between stages.
"""

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.sensors.external_task import ExternalTaskSensor
from datetime import datetime, timedelta

# Default arguments for all tasks
default_args = {
    'owner': 'pedal',
    'depends_on_past': False,
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# DAG definition
with DAG(
    dag_id='pedal_artifact_pipeline',
    default_args=default_args,
    description='Multi-stage artifact generation pipeline for DDD workflows',
    start_date=datetime(2025, 4, 7),
    schedule_interval=None,  # Manual triggers only
    catchup=False,
    tags=['pedal', 'ddd', 'artifacts'],
) as dag:

    # Stage 1: Requirements Ingest
    requirements_ingest = BashOperator(
        task_id='requirements_ingest',
        bash_command='export TASK_ID=requirements_ingest && node /pedal/operators/requirements_ingest.ts --input /pedal/artifacts/requirements.yaml --output /pedal/artifacts/requirements.json',
        dag=dag,
    )

    # Approval for Requirements Ingest
    approve_requirements_ingest = ExternalTaskSensor(
        task_id='approve_requirements_ingest',
        external_dag_id='approval_workflow',
        external_task_id='approve_requirements_ingest',
        timeout=3600,  # 1 hour timeout
        mode='reschedule',  # Keep checking until the task is complete
        poke_interval=60,  # Check every minute
        dag=dag,
    )

    # Stage 2: Domain Model Generator
    domain_model_generator = BashOperator(
        task_id='domain_model_generator',
        bash_command='export TASK_ID=domain_model_generator && node /pedal/operators/domain_model_generator.ts --input /pedal/artifacts/requirements.json --output /pedal/artifacts/domain_model.json',
        dag=dag,
    )

    # Approval for Domain Model Generator
    approve_domain_model_generator = ExternalTaskSensor(
        task_id='approve_domain_model_generator',
        external_dag_id='approval_workflow',
        external_task_id='approve_domain_model_generator',
        timeout=3600,
        mode='reschedule',
        poke_interval=60,
        dag=dag,
    )

    # Stage 3: Action Model Generator
    action_model_generator = BashOperator(
        task_id='action_model_generator',
        bash_command='export TASK_ID=action_model_generator && node /pedal/operators/action_model_generator.ts --input /pedal/artifacts/domain_model.json --output /pedal/artifacts/action_model.json',
        dag=dag,
    )

    # Approval for Action Model Generator
    approve_action_model_generator = ExternalTaskSensor(
        task_id='approve_action_model_generator',
        external_dag_id='approval_workflow',
        external_task_id='approve_action_model_generator',
        timeout=3600,
        mode='reschedule',
        poke_interval=60,
        dag=dag,
    )

    # Stage 4: OpenAPI Generator
    openapi_generator = BashOperator(
        task_id='openapi_generator',
        bash_command='export TASK_ID=openapi_generator && node /pedal/operators/openapi_generator.ts --input /pedal/artifacts/action_model.json --output /pedal/artifacts/oas.yaml',
        dag=dag,
    )

    # Approval for OpenAPI Generator
    approve_openapi_generator = ExternalTaskSensor(
        task_id='approve_openapi_generator',
        external_dag_id='approval_workflow',
        external_task_id='approve_openapi_generator',
        timeout=3600,
        mode='reschedule',
        poke_interval=60,
        dag=dag,
    )

    # Stage 5: Zod Schema Generator
    zod_schema_generator = BashOperator(
        task_id='zod_schema_generator',
        bash_command='export TASK_ID=zod_schema_generator && node /pedal/operators/zod_schema_generator.ts --input /pedal/artifacts/oas.yaml --output /pedal/artifacts/zod_schemas.ts',
        dag=dag,
    )

    # Approval for Zod Schema Generator
    approve_zod_schema_generator = ExternalTaskSensor(
        task_id='approve_zod_schema_generator',
        external_dag_id='approval_workflow',
        external_task_id='approve_zod_schema_generator',
        timeout=3600,
        mode='reschedule',
        poke_interval=60,
        dag=dag,
    )

    # Stage 6: Database Schema Generator
    database_schema_generator = BashOperator(
        task_id='database_schema_generator',
        bash_command='export TASK_ID=database_schema_generator && node /pedal/operators/database_schema_generator.ts --input /pedal/artifacts/zod_schemas.ts --output /pedal/artifacts/db_schema.ts',
        dag=dag,
    )

    # Approval for Database Schema Generator
    approve_database_schema_generator = ExternalTaskSensor(
        task_id='approve_database_schema_generator',
        external_dag_id='approval_workflow',
        external_task_id='approve_database_schema_generator',
        timeout=3600,
        mode='reschedule',
        poke_interval=60,
        dag=dag,
    )

    # Stage 7: Artifact Persist
    artifact_persist = BashOperator(
        task_id='artifact_persist',
        bash_command='export TASK_ID=artifact_persist && node /pedal/operators/artifact_persist.ts --input /pedal/artifacts --output /pedal/dist',
        dag=dag,
    )

    # Task dependencies - sequential flow with approval gates
    requirements_ingest >> approve_requirements_ingest >> domain_model_generator >> approve_domain_model_generator >> \
    action_model_generator >> approve_action_model_generator >> openapi_generator >> approve_openapi_generator >> \
    zod_schema_generator >> approve_zod_schema_generator >> database_schema_generator >> approve_database_schema_generator >> \
    artifact_persist
