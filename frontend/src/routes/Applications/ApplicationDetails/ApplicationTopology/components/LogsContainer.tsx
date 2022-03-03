/* Copyright Contributors to the Open Cluster Management project */

import _ from 'lodash'
import { useEffect, useState } from 'react'
import { fetchRetry, getBackendUrl } from '../../../../../resources'
import { PageSection, SelectOption } from '@patternfly/react-core'
import { AcmAlert, AcmLoadingPage, AcmLogWindow, AcmSelect } from '@stolostron/ui-components'
import { TFunction } from 'i18next'
import './LogsContainer.css'
import { createResourceURL } from '../helpers/diagram-helpers'

export interface ILogsContainerProps {
    node: any[]
    t: TFunction
    renderResourceURLLink: (data: any, t: TFunction, isPod: boolean) => void
}

export function LogsContainer(props: ILogsContainerProps) {
    let resourceError = ''
    const t = props.t
    const podModel = _.get(props.node, 'specs.podModel')
    const pods = podModel
        ? Object.keys(podModel).map((key) => {
              return podModel[key][0]
          })
        : []

    if (pods.length === 0) {
        resourceError = t('No pods found')
    }

    let initialPod = ''
    let initialContainers: string[] = []
    let initialContainer = ''
    let namespace = ''
    let cluster = ''
    let initialPodURL = ''
    if (pods.length > 0) {
        initialPod = pods[0].name
        initialContainers = pods[0].container
            ? pods[0].container.split(';').map((item: string) => {
                  return item.trim()
              })
            : []
        initialContainer = initialContainers.length > 0 ? initialContainers[0] : ''
        namespace = pods[0].namespace
        cluster = pods[0].cluster
        initialPodURL = createResourceURL(
            {
                cluster,
                type: pods[0].kind,
                namespace,
                name: initialPod,
                specs: {
                    raw: {
                        apiVersion: pods[0].apiversion,
                    },
                },
            },
            t,
            true
        )
    }
    const [selectedPod, setSelectedPod] = useState<string | ''>(initialPod)
    const [logs, setLogs] = useState<string>('')
    const [logsError, setLogsError] = useState<string>()
    const [container, setContainer] = useState<string>(initialContainer)
    const [currentContainers, setCurrentContainers] = useState<string[]>(initialContainers)
    const [currentPodURL, setCurrentPodURL] = useState<string>(initialPodURL)

    useEffect(() => {
        if (cluster !== 'local-cluster' && container !== '') {
            const abortController = new AbortController()
            const logsResult = fetchRetry({
                method: 'GET',
                url:
                    getBackendUrl() +
                    `/apis/proxy.open-cluster-management.io/v1beta1/namespaces/${cluster}/clusterstatuses/${cluster}/log/${namespace}/${selectedPod}/${container}?tailLines=1000`,
                signal: abortController.signal,
                retries: process.env.NODE_ENV === 'production' ? 2 : 0,
                headers: { Accept: '*/*' },
            })
            logsResult
                .then((result) => {
                    setLogs(result.data as string)
                })
                .catch((err) => {
                    setLogsError(err.message)
                })
        } else if (cluster === 'local-cluster' && container !== '') {
            const abortController = new AbortController()
            const logsResult = fetchRetry({
                method: 'GET',
                url:
                    getBackendUrl() +
                    `/api/v1/namespaces/${namespace}/pods/${selectedPod}/log?container=${container}&tailLines=1000`,
                signal: abortController.signal,
                retries: process.env.NODE_ENV === 'production' ? 2 : 0,
                headers: { Accept: '*/*' },
            })
            logsResult
                .then((result) => {
                    setLogs(result.data as string)
                })
                .catch((err) => {
                    setLogsError(err.message)
                })
        }
    }, [cluster, container, selectedPod])

    if (resourceError !== '') {
        return (
            <PageSection>
                <AcmAlert
                    noClose={true}
                    variant={'danger'}
                    isInline={true}
                    title={`${t('Error querying resource logs:')} ${selectedPod}`}
                    subtitle={resourceError}
                />
            </PageSection>
        )
    } else if (resourceError === '' && !logsError && logs === '') {
        return (
            <PageSection>
                <AcmLoadingPage />
            </PageSection>
        )
    }
    if (logsError) {
        return (
            <PageSection>
                <AcmAlert
                    noClose={true}
                    variant={'danger'}
                    isInline={true}
                    title={`${t('Error querying resource logs:')} ${selectedPod}`}
                    subtitle={logsError}
                />
            </PageSection>
        )
    }

    return (
        <div>
            {props.renderResourceURLLink(
                {
                    data: {
                        action: 'open_link',
                        targetLink: currentPodURL,
                        name: selectedPod,
                        namespace,
                        kind: 'pod',
                    },
                },
                t,
                true
            )}
            <span className="pod-dropdown label sectionLabel">{t('Select pod')}</span>
            <AcmSelect
                id={'container-select'}
                label={''}
                className="custom-select-class"
                value={selectedPod}
                isRequired={true}
                onChange={(value) => {
                    setSelectedPod(value as string)
                    const selectedPodData =
                        pods.find((item: any) => {
                            return item.name === value
                        }) || {}
                    const selectedPodContainers = selectedPodData.container
                        ? selectedPodData.container.split(';').map((item: string) => {
                              return item.trim()
                          })
                        : []
                    setCurrentContainers(selectedPodContainers)
                    const selectedPodInitialContainer = selectedPodContainers.length > 0 ? selectedPodContainers[0] : ''
                    setContainer(selectedPodInitialContainer)
                    setCurrentPodURL(
                        createResourceURL(
                            {
                                cluster: selectedPodData.cluster,
                                type: 'pod',
                                namespace: selectedPodData.namespace,
                                name: value,
                                specs: {
                                    raw: {
                                        apiVersion: selectedPodData.apiversion,
                                    },
                                },
                            },
                            t,
                            true
                        )
                    )
                }}
            >
                {pods.map((pod: any) => {
                    return (
                        <SelectOption key={pod.name} value={pod.name}>
                            {pod.name}
                        </SelectOption>
                    )
                })}
            </AcmSelect>
            <span className="container-dropdown label sectionLabel">{t('Select container')}</span>
            <AcmLogWindow
                id={'pod-logs-viewer'}
                cluster={cluster}
                namespace={namespace}
                initialContainer={container}
                onSwitchContainer={(newContainer: string | undefined) => {
                    setContainer(newContainer || container)
                }}
                containers={currentContainers}
                logs={logs || ''}
            />
        </div>
    )
}